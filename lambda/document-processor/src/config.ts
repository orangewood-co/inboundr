export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";

export const DEFAULT_MARKDOWN_MODEL = "google/gemini-2.5-flash";

// Bounds ported from the previous in-process Drive indexing pipeline.
export const MAX_MARKDOWN_CHARS = 200_000;
export const MAX_SPREADSHEET_SHEETS = 10;
export const MAX_SPREADSHEET_ROWS_PER_SHEET = 2_000;

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function getDatabaseConfig(): DatabaseConfig {
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  if (!database || !user || !password) {
    throw new Error(
      "DB_NAME, DB_USER, and DB_PASSWORD must be set for the document pipeline."
    );
  }
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || "5432"),
    database,
    user,
    password,
  };
}

export function getStorageBucket(): string {
  const bucket = process.env.S3_UPLOAD_BUCKET;
  if (!bucket) {
    throw new Error("S3_UPLOAD_BUCKET must be set for the document pipeline.");
  }
  return bucket;
}

export function getMarkdownModel(): string {
  return process.env.DOC_MARKDOWN_MODEL || DEFAULT_MARKDOWN_MODEL;
}

export function getMaxPdfPages(): number {
  return Number(process.env.DOC_MAX_PDF_PAGES || "200");
}

export function getPdfPageBatchSize(): number {
  return Number(process.env.DOC_PDF_PAGE_BATCH_SIZE || "15");
}

export function getLlmConcurrency(): number {
  return Number(process.env.DOC_LLM_CONCURRENCY || "3");
}
