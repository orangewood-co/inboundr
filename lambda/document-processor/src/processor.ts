import crypto from "node:crypto";
import type { Pool } from "pg";

import { chunkMarkdown } from "./chunking";
import { EMBEDDING_MODEL, MAX_MARKDOWN_CHARS } from "./config";
import { detectDocumentKind } from "./convert/detect";
import { convertPdfToMarkdown } from "./convert/pdf-to-markdown";
import { convertSpreadsheetToMarkdown } from "./convert/spreadsheet";
import { convertTextToMarkdown } from "./convert/text";
import { ensureSchema, getPool } from "./db";
import { embedTexts, toVectorLiteral } from "./embeddings";
import { getObjectBuffer, putObjectBuffer } from "./s3";
import type { DocumentRow, DocumentStatus } from "./schema";

const INSERT_BATCH_ROWS = 100;

async function loadDocument(pool: Pool, documentId: string): Promise<DocumentRow | null> {
  const result = await pool.query<DocumentRow>(
    `SELECT id, organization_id, source_type, source_id, file_name, content_type,
            storage_key, markdown_key, content_hash, status, error, chunk_count,
            embedding_model, processed_at
       FROM documents
      WHERE id = $1`,
    [documentId]
  );
  return result.rows[0] ?? null;
}

async function setStatus(
  pool: Pool,
  documentId: string,
  status: DocumentStatus,
  error: string | null = null
): Promise<void> {
  await pool.query(
    `UPDATE documents
        SET status = $2, error = $3, updated_at = now()
      WHERE id = $1`,
    [documentId, status, error]
  );
}

async function markProcessed(
  pool: Pool,
  input: {
    documentId: string;
    status: Extract<DocumentStatus, "completed" | "unsupported">;
    chunkCount: number;
    contentHash: string | null;
    markdownKey: string | null;
  }
): Promise<void> {
  await pool.query(
    `UPDATE documents
        SET status = $2,
            chunk_count = $3,
            content_hash = $4,
            markdown_key = $5,
            embedding_model = $6,
            error = NULL,
            processed_at = now(),
            updated_at = now()
      WHERE id = $1`,
    [
      input.documentId,
      input.status,
      input.chunkCount,
      input.contentHash,
      input.markdownKey,
      input.chunkCount > 0 ? EMBEDDING_MODEL : null,
    ]
  );
}

async function deleteChunks(pool: Pool, documentId: string): Promise<void> {
  await pool.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);
}

/**
 * Transactionally replaces every chunk for a document. Delete-and-reinsert
 * keeps the operation idempotent under SQS at-least-once delivery.
 */
async function replaceChunks(
  pool: Pool,
  input: {
    documentId: string;
    organizationId: string;
    chunks: string[];
    embeddings: number[][];
  }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
      input.documentId,
    ]);

    for (let offset = 0; offset < input.chunks.length; offset += INSERT_BATCH_ROWS) {
      const batch = input.chunks.slice(offset, offset + INSERT_BATCH_ROWS);
      const values: string[] = [];
      const params: unknown[] = [];
      batch.forEach((chunk, i) => {
        const base = i * 5;
        values.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5}::vector)`
        );
        params.push(
          input.documentId,
          input.organizationId,
          offset + i,
          chunk,
          toVectorLiteral(input.embeddings[offset + i]!)
        );
      });
      await client.query(
        `INSERT INTO document_chunks
           (document_id, organization_id, chunk_index, content, embedding)
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

async function convertToMarkdown(
  kind: "pdf" | "spreadsheet" | "text",
  buffer: Buffer,
  fileName: string
): Promise<string> {
  switch (kind) {
    case "pdf":
      return convertPdfToMarkdown(buffer, fileName);
    case "spreadsheet":
      return convertSpreadsheetToMarkdown(buffer, fileName);
    case "text":
      return convertTextToMarkdown(buffer);
  }
}

/**
 * Runs the full pipeline for one document: download from S3, convert to
 * markdown, store the markdown artifact back to S3, chunk, embed, and replace
 * the stored chunks. Status transitions are recorded on the documents row.
 *
 * Safe to re-run: unchanged content (by hash) is skipped, and chunk writes are
 * transactional delete-and-replace.
 */
export async function processDocument(documentId: string): Promise<void> {
  const pool = getPool();
  await ensureSchema();

  const doc = await loadDocument(pool, documentId);
  if (!doc) {
    console.warn(`Document ${documentId} not found; skipping.`);
    return;
  }

  try {
    await setStatus(pool, documentId, "processing");

    const buffer = await getObjectBuffer(doc.storage_key);
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    if (doc.processed_at && doc.status !== "failed" && doc.content_hash === contentHash) {
      await setStatus(pool, documentId, doc.status === "unsupported" ? "unsupported" : "completed");
      return;
    }

    const kind = detectDocumentKind(doc.content_type, doc.file_name);
    if (kind === "unsupported") {
      await deleteChunks(pool, documentId);
      await markProcessed(pool, {
        documentId,
        status: "unsupported",
        chunkCount: 0,
        contentHash,
        markdownKey: null,
      });
      return;
    }

    const markdown = (await convertToMarkdown(kind, buffer, doc.file_name))
      .slice(0, MAX_MARKDOWN_CHARS)
      .trim();

    if (!markdown) {
      await deleteChunks(pool, documentId);
      await markProcessed(pool, {
        documentId,
        status: "completed",
        chunkCount: 0,
        contentHash,
        markdownKey: null,
      });
      return;
    }

    const markdownKey = `document-markdown/${doc.organization_id}/${documentId}.md`;
    await putObjectBuffer({
      key: markdownKey,
      body: Buffer.from(markdown, "utf-8"),
      contentType: "text/markdown; charset=utf-8",
    });

    const chunks = chunkMarkdown(markdown);
    const embeddings = await embedTexts(chunks);

    await replaceChunks(pool, {
      documentId,
      organizationId: doc.organization_id,
      chunks,
      embeddings,
    });

    await markProcessed(pool, {
      documentId,
      status: "completed",
      chunkCount: chunks.length,
      contentHash,
      markdownKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Document processing failed";
    await setStatus(pool, documentId, "failed", message.slice(0, 500)).catch(
      (statusErr) => {
        console.error(`Failed to record failure for document ${documentId}:`, statusErr);
      }
    );
    throw err;
  }
}
