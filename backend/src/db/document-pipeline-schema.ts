import { provisionDocumentPipelineSchema } from "@btsa/document-processor";

import { getKnowledgePool } from "./knowledge-schema";

let schemaReady: Promise<void> | null = null;

/**
 * Idempotently provisions the general document pipeline tables (documents +
 * document_chunks). The DDL is owned by the document-processor package so the
 * Lambda and the backend always agree on the schema. Safe to call repeatedly;
 * the underlying work only runs once per process.
 */
export function ensureDocumentPipelineSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = provisionDocumentPipelineSchema(getKnowledgePool()).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
