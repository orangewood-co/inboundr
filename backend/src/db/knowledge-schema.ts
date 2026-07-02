import { Pool } from "pg";

import { getDatabaseConfigFromEnv } from "../utils/product-search";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;

let pool: Pool | null = null;

/**
 * Shared connection pool for the RAG knowledge store. Reuses the same
 * PostgreSQL instance/credentials as the product catalog.
 *
 * The document tables themselves are owned by the document pipeline; see
 * db/document-pipeline-schema.ts. (The legacy drive_document_chunks table is
 * no longer provisioned or read — drop it manually once the reindex onto the
 * pipeline has completed.)
 */
export function getKnowledgePool(): Pool {
  if (!pool) {
    pool = new Pool(getDatabaseConfigFromEnv());
  }
  return pool;
}
