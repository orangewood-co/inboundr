import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { processDocument } from "@btsa/document-processor";

import { ensureDocumentPipelineSchema } from "../db/document-pipeline-schema";
import { getKnowledgePool } from "../db/knowledge-schema";
import { deleteObject } from "./storage.service";

export type EnqueueDocumentInput = {
  organizationId: string;
  sourceType: string;
  sourceId: string;
  storageKey: string;
  fileName: string;
  contentType: string | null;
};

let sqsClient: SQSClient | null = null;

function getSqsClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({});
  }
  return sqsClient;
}

/**
 * Registers (or refreshes) a document in the pipeline and hands it to the
 * processing worker. With SQS_DOCUMENT_QUEUE_URL set, the document is queued
 * for the Lambda; without it (local dev), processing runs in-process instead.
 *
 * Returns the pipeline document id.
 */
export async function enqueueDocument(input: EnqueueDocumentInput): Promise<string> {
  await ensureDocumentPipelineSchema();

  const result = await getKnowledgePool().query<{ id: string }>(
    `INSERT INTO documents
       (organization_id, source_type, source_id, file_name, content_type, storage_key, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued', NULL)
     ON CONFLICT (source_type, source_id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       file_name = EXCLUDED.file_name,
       content_type = EXCLUDED.content_type,
       storage_key = EXCLUDED.storage_key,
       status = 'queued',
       error = NULL,
       updated_at = now()
     RETURNING id`,
    [
      input.organizationId,
      input.sourceType,
      input.sourceId,
      input.fileName,
      input.contentType,
      input.storageKey,
    ]
  );
  const documentId = result.rows[0]!.id;

  const queueUrl = process.env.SQS_DOCUMENT_QUEUE_URL;
  if (queueUrl) {
    await getSqsClient().send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ documentId }),
      })
    );
  } else {
    await processDocument(documentId);
  }

  return documentId;
}

/**
 * Removes a document and its chunks from the pipeline (chunks cascade with
 * the row), plus the generated markdown artifact in S3 when one exists.
 */
export async function removeDocument(
  sourceType: string,
  sourceId: string
): Promise<void> {
  await ensureDocumentPipelineSchema();

  const result = await getKnowledgePool().query<{ markdown_key: string | null }>(
    `DELETE FROM documents
      WHERE source_type = $1 AND source_id = $2
      RETURNING markdown_key`,
    [sourceType, sourceId]
  );

  for (const row of result.rows) {
    if (!row.markdown_key) continue;
    try {
      await deleteObject(row.markdown_key);
    } catch (err) {
      console.error(`Failed to delete markdown artifact ${row.markdown_key}:`, err);
    }
  }
}
