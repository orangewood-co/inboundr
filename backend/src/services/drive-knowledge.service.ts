import type { Types } from "mongoose";

import { ensureDocumentPipelineSchema } from "../db/document-pipeline-schema";
import { getKnowledgePool } from "../db/knowledge-schema";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import { isExtractableNode } from "./document-extraction.service";
import { enqueueDocument, removeDocument } from "./document-pipeline.service";
import { embedQuery, toVectorLiteral } from "./embedding.service";

const DRIVE_SOURCE_TYPE = "drive";
const MAX_ANCESTOR_WALK = 64;

export type KnowledgeMatch = {
  nodeId: string;
  fileName: string;
  content: string;
  score: number;
};

/**
 * Hands a Drive file to the general document pipeline (convert to markdown,
 * chunk, embed). Unsupported files just get any stale pipeline state cleared.
 */
export async function indexNode(node: IDriveNode): Promise<void> {
  const nodeId = String(node._id);

  if (!isExtractableNode(node) || !node.storageKey) {
    await removeDocument(DRIVE_SOURCE_TYPE, nodeId);
    return;
  }

  await enqueueDocument({
    organizationId: node.organizationId.toString(),
    sourceType: DRIVE_SOURCE_TYPE,
    sourceId: nodeId,
    storageKey: node.storageKey,
    fileName: node.name,
    contentType: node.contentType ?? null,
  });
}

/**
 * Removes all stored chunks and pipeline state for a single node.
 */
export async function removeNode(nodeId: string): Promise<void> {
  await removeDocument(DRIVE_SOURCE_TYPE, nodeId);
}

/**
 * Walks parentId ancestors to determine whether a node sits inside a folder
 * that has been marked "Use for chat context".
 */
export async function isNodeInChatContext(node: IDriveNode): Promise<boolean> {
  let parentId = node.parentId;
  let guard = 0;
  while (parentId && guard < MAX_ANCESTOR_WALK) {
    const parent = await DriveNode.findById(parentId)
      .select("parentId type chatContext")
      .lean();
    if (!parent) break;
    if (parent.type === "folder" && parent.chatContext?.enabled) return true;
    parentId = parent.parentId;
    guard++;
  }
  return false;
}

async function collectDescendantFiles(
  organizationId: Types.ObjectId,
  folderId: Types.ObjectId,
  options: { includeAllStatuses?: boolean } = {}
): Promise<IDriveNode[]> {
  const files: IDriveNode[] = [];
  let frontier: Types.ObjectId[] = [folderId];
  let guard = 0;

  while (frontier.length > 0 && guard < 10_000) {
    const filter: Record<string, unknown> = {
      organizationId,
      parentId: { $in: frontier },
    };
    if (!options.includeAllStatuses) filter.status = "active";

    const children = await DriveNode.find(filter);
    const nextFolders: Types.ObjectId[] = [];
    for (const child of children) {
      guard++;
      if (child.type === "folder") {
        nextFolders.push(child._id as Types.ObjectId);
      } else {
        files.push(child);
      }
    }
    frontier = nextFolders;
  }

  return files;
}

/**
 * Enqueues every supported file under a folder (recursively) onto the
 * document pipeline. Failures on individual files are logged and do not
 * abort the batch.
 */
export async function indexFolderSubtree(
  organizationId: Types.ObjectId,
  folderId: Types.ObjectId
): Promise<void> {
  const files = await collectDescendantFiles(organizationId, folderId);
  for (const file of files) {
    try {
      await indexNode(file);
    } catch (err) {
      console.error(
        `Failed to index drive node ${String(file._id)} for chat context:`,
        err
      );
    }
  }
}

/**
 * Removes stored chunks/pipeline state for every file under a folder.
 */
export async function removeFolderSubtree(
  organizationId: Types.ObjectId,
  folderId: Types.ObjectId
): Promise<void> {
  const files = await collectDescendantFiles(organizationId, folderId, {
    includeAllStatuses: true,
  });
  for (const file of files) {
    try {
      await removeNode(String(file._id));
    } catch (err) {
      console.error(
        `Failed to remove drive node ${String(file._id)} from chat context:`,
        err
      );
    }
  }
}

/**
 * Embeds the query and returns the most similar chunks for the organization,
 * ranked by cosine similarity.
 */
export async function searchKnowledge(input: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeMatch[]> {
  await ensureDocumentPipelineSchema();

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 8);
  const embedding = await embedQuery(input.query);
  const literal = toVectorLiteral(embedding);

  const result = await getKnowledgePool().query<{
    node_id: string;
    file_name: string;
    content: string;
    score: string;
  }>(
    `SELECT d.source_id AS node_id,
            d.file_name,
            c.content,
            1 - (c.embedding <=> $1::vector) AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.organization_id = $2
        AND d.source_type = $3
      ORDER BY c.embedding <=> $1::vector
      LIMIT $4`,
    [literal, input.organizationId, DRIVE_SOURCE_TYPE, limit]
  );

  return result.rows.map((row) => ({
    nodeId: row.node_id,
    fileName: row.file_name,
    content: row.content,
    score: Number(row.score),
  }));
}
