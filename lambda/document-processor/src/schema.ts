import type { Pool } from "pg";

import { EMBEDDING_DIMENSIONS } from "./config";

export type DocumentStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "unsupported";

export type DocumentRow = {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  file_name: string;
  content_type: string | null;
  storage_key: string;
  markdown_key: string | null;
  content_hash: string | null;
  status: DocumentStatus;
  error: string | null;
  chunk_count: number;
  embedding_model: string | null;
  processed_at: Date | null;
};

/**
 * Provisions the general document pipeline tables. The pipeline owns this DDL;
 * both the Lambda and the backend call it with their own connection pool.
 * Idempotent — every statement is IF NOT EXISTS.
 */
export async function provisionDocumentPipelineSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT,
        storage_key TEXT NOT NULL,
        markdown_key TEXT,
        content_hash TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        error TEXT,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        embedding_model TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ,
        UNIQUE (source_type, source_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS documents_org_idx
        ON documents (organization_id)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id BIGSERIAL PRIMARY KEY,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_document_idx
        ON document_chunks (document_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_org_idx
        ON document_chunks (organization_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
    `);
  } finally {
    client.release();
  }
}
