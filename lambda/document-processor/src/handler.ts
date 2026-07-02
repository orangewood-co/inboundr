import type { SQSBatchResponse, SQSEvent } from "aws-lambda";

import { processDocument } from "./processor";

export type DocumentQueueMessage = {
  documentId: string;
};

/**
 * SQS entry point. Failed records are reported as partial batch failures so
 * SQS redelivers only those (and routes them to the DLQ after maxReceiveCount).
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    let documentId: string | undefined;
    try {
      const body = JSON.parse(record.body) as Partial<DocumentQueueMessage>;
      documentId = body.documentId;
    } catch {
      console.error(`Discarding malformed message ${record.messageId}: ${record.body}`);
      continue;
    }
    if (!documentId) {
      console.error(`Discarding message ${record.messageId} without documentId.`);
      continue;
    }

    try {
      await processDocument(documentId);
    } catch (err) {
      console.error(`Failed to process document ${documentId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
