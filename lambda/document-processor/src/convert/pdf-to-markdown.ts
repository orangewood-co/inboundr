import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";

import {
  getLlmConcurrency,
  getMarkdownModel,
  getMaxPdfPages,
  getPdfPageBatchSize,
} from "../config";

const CONVERSION_PROMPT = `Transcribe this PDF into clean, well-structured GitHub-flavored Markdown.

Rules:
- Preserve the heading hierarchy using #, ##, ###, etc.
- Reproduce tables as Markdown tables.
- Preserve lists, bold/italic emphasis, and paragraph structure.
- Transcribe the text faithfully; do not summarize, translate, or add commentary.
- For images, charts, or diagrams, insert a short italic description of what they show.
- Skip blank pages, page numbers, and repeated page headers/footers.
- Output only the Markdown content. Do not wrap it in a code fence.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set; PDF markdown conversion is unavailable."
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    });
  }
  return client;
}

/**
 * Splits a PDF into sub-documents of at most `batchSize` pages, capped at
 * `maxPages` total. Returns the original buffer untouched when it already
 * fits in a single batch, to avoid a lossy pdf-lib re-save.
 */
async function splitIntoPageBatches(
  data: Buffer,
  batchSize: number,
  maxPages: number
): Promise<Buffer[]> {
  const source = await PDFDocument.load(data, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const totalPages = source.getPageCount();
  if (totalPages <= batchSize && totalPages <= maxPages) {
    return [data];
  }

  const pageCount = Math.min(totalPages, maxPages);
  const batches: Buffer[] = [];
  for (let start = 0; start < pageCount; start += batchSize) {
    const end = Math.min(start + batchSize, pageCount);
    const doc = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const pages = await doc.copyPages(source, indices);
    for (const page of pages) doc.addPage(page);
    batches.push(Buffer.from(await doc.save()));
  }
  return batches;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]!, index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function convertBatch(pdf: Buffer, fileName: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: getMarkdownModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: fileName,
              file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
            },
          },
          { type: "text", text: CONVERSION_PROMPT },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Converts a PDF to markdown by sending page batches to a vision-capable
 * model via OpenRouter and concatenating the per-batch transcriptions.
 */
export async function convertPdfToMarkdown(
  data: Buffer,
  fileName: string
): Promise<string> {
  const batches = await splitIntoPageBatches(
    data,
    getPdfPageBatchSize(),
    getMaxPdfPages()
  );
  const parts = await mapWithConcurrency(batches, getLlmConcurrency(), (batch) =>
    convertBatch(batch, fileName)
  );
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
