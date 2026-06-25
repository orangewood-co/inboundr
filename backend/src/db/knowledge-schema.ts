import { Pool } from "pg";

import { getDatabaseConfigFromEnv } from "../utils/product-search";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;

let pool: Pool | null = null;

/**
 * Shared connection pool for the RAG knowledge store. Reuses the same
 * PostgreSQL instance/credentials as the product catalog.
 */
export function getKnowledgePool(): Pool {
  if (!pool) {
    pool = new Pool(getDatabaseConfigFromEnv());
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

/**
 * Idempotently provisions the pgvector extension, the chunk table, and the
 * indexes used for org-scoped cosine retrieval. Safe to call repeatedly; the
 * underlying work only runs once per process.
 */
export function ensureKnowledgeSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = provisionSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function provisionSchema(): Promise<void> {
  const client = await getKnowledgePool().connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drive_document_chunks (
        id BIGSERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        folder_id TEXT,
        file_name TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${KNOWLEDGE_EMBEDDING_DIMENSIONS}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS drive_document_chunks_org_node_idx
        ON drive_document_chunks (organization_id, node_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS drive_document_chunks_embedding_idx
        ON drive_document_chunks
        USING hnsw (embedding vector_cosine_ops)
    `);
  } finally {
    client.release();
  }
}
