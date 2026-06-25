import crypto from "node:crypto";
import type { Types } from "mongoose";

import { ensureKnowledgeSchema, getKnowledgePool } from "../db/knowledge-schema";
import {
  DriveDocumentIndex,
  type DriveDocumentIndexStatus,
} from "../models/drive-document-index.model";
import { DriveNode, type IDriveNode } from "../models/drive-node.model";
import {
  extractDriveNodeText,
  isExtractableNode,
} from "./document-extraction.service";
import { embedQuery, embedTexts, toVectorLiteral } from "./embedding.service";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_DOCUMENT = 400;
const INSERT_BATCH_ROWS = 100;
const MAX_ANCESTOR_WALK = 64;

export type KnowledgeMatch = {
  nodeId: string;
  fileName: string;
  content: string;
  score: number;
};

/**
 * Splits text into overlapping chunks, preferring to break on whitespace so
 * chunks stay semantically coherent.
 */
function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" ")
      );
      if (breakAt > CHUNK_SIZE - 200) {
        end = start + breakAt + 1;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

async function upsertIndexStatus(input: {
  organizationId: Types.ObjectId;
  nodeId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  status: DriveDocumentIndexStatus;
  chunkCount: number;
  contentHash: string | null;
  error: string | null;
  indexedAt?: Date | null;
}): Promise<void> {
  await DriveDocumentIndex.findOneAndUpdate(
    { nodeId: input.nodeId },
    {
      organizationId: input.organizationId,
      nodeId: input.nodeId,
      folderId: input.folderId,
      status: input.status,
      chunkCount: input.chunkCount,
      contentHash: input.contentHash,
      error: input.error,
      indexedAt: input.indexedAt ?? null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function deleteChunks(nodeId: string): Promise<void> {
  await getKnowledgePool().query(
    "DELETE FROM drive_document_chunks WHERE node_id = $1",
    [nodeId]
  );
}

async function replaceChunks(input: {
  organizationId: string;
  nodeId: string;
  folderId: string | null;
  fileName: string;
  chunks: string[];
  embeddings: number[][];
}): Promise<void> {
  const client = await getKnowledgePool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM drive_document_chunks WHERE node_id = $1", [
      input.nodeId,
    ]);

    for (let offset = 0; offset < input.chunks.length; offset += INSERT_BATCH_ROWS) {
      const batch = input.chunks.slice(offset, offset + INSERT_BATCH_ROWS);
      const values: string[] = [];
      const params: unknown[] = [];
      batch.forEach((chunk, i) => {
        const base = i * 7;
        values.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7}::vector)`
        );
        params.push(
          input.organizationId,
          input.nodeId,
          input.folderId,
          input.fileName,
          offset + i,
          chunk,
          toVectorLiteral(input.embeddings[offset + i]!)
        );
      });
      await client.query(
        `INSERT INTO drive_document_chunks
           (organization_id, node_id, folder_id, file_name, chunk_index, content, embedding)
         VALUES ${values.join(",")}`,
        params
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Extracts, chunks, embeds, and stores a single Drive file. Skips work when the
 * content hash matches a prior successful index. Records status in Mongo.
 */
export async function indexNode(node: IDriveNode): Promise<void> {
  const organizationId = node.organizationId;
  const nodeId = node._id as Types.ObjectId;
  const folderId = node.parentId;

  if (!isExtractableNode(node)) {
    await deleteChunks(nodeId.toString());
    await upsertIndexStatus({
      organizationId,
      nodeId,
      folderId,
      status: "unsupported",
      chunkCount: 0,
      contentHash: null,
      error: null,
    });
    return;
  }

  try {
    await ensureKnowledgeSchema();
    const extraction = await extractDriveNodeText(node);

    if (extraction.status !== "extracted") {
      await deleteChunks(nodeId.toString());
      await upsertIndexStatus({
        organizationId,
        nodeId,
        folderId,
        status: extraction.status === "empty" ? "indexed" : "unsupported",
        chunkCount: 0,
        contentHash: null,
        error: null,
        indexedAt: extraction.status === "empty" ? new Date() : null,
      });
      return;
    }

    const contentHash = crypto
      .createHash("sha256")
      .update(extraction.text)
      .digest("hex");

    const existing = await DriveDocumentIndex.findOne({ nodeId }).lean();
    if (existing && existing.status === "indexed" && existing.contentHash === contentHash) {
      return;
    }

    const chunks = chunkText(extraction.text);
    if (chunks.length === 0) {
      await deleteChunks(nodeId.toString());
      await upsertIndexStatus({
        organizationId,
        nodeId,
        folderId,
        status: "indexed",
        chunkCount: 0,
        contentHash,
        error: null,
        indexedAt: new Date(),
      });
      return;
    }

    const embeddings = await embedTexts(chunks);
    await replaceChunks({
      organizationId: organizationId.toString(),
      nodeId: nodeId.toString(),
      folderId: folderId ? folderId.toString() : null,
      fileName: node.name,
      chunks,
      embeddings,
    });

    await upsertIndexStatus({
      organizationId,
      nodeId,
      folderId,
      status: "indexed",
      chunkCount: chunks.length,
      contentHash,
      error: null,
      indexedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    await upsertIndexStatus({
      organizationId,
      nodeId,
      folderId,
      status: "failed",
      chunkCount: 0,
      contentHash: null,
      error: message.slice(0, 500),
    });
    throw err;
  }
}

/**
 * Removes all stored chunks and index status for a single node.
 */
export async function removeNode(nodeId: string): Promise<void> {
  await deleteChunks(nodeId);
  await DriveDocumentIndex.deleteOne({ nodeId });
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
 * Indexes every supported file under a folder (recursively). Runs sequentially
 * to avoid overwhelming the embedding API; failures on individual files are
 * recorded per node and do not abort the batch.
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
 * Removes stored chunks/index status for every file under a folder.
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
  await ensureKnowledgeSchema();

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 8);
  const embedding = await embedQuery(input.query);
  const literal = toVectorLiteral(embedding);

  const result = await getKnowledgePool().query<{
    node_id: string;
    file_name: string;
    content: string;
    score: string;
  }>(
    `SELECT node_id, file_name, content, 1 - (embedding <=> $1::vector) AS score
       FROM drive_document_chunks
      WHERE organization_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    [literal, input.organizationId, limit]
  );

  return result.rows.map((row) => ({
    nodeId: row.node_id,
    fileName: row.file_name,
    content: row.content,
    score: Number(row.score),
  }));
}
