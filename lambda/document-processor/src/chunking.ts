const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_DOCUMENT = 400;

/**
 * Splits text into overlapping chunks, preferring to break on whitespace so
 * chunks stay semantically coherent. Ported from the previous in-process
 * Drive indexing pipeline.
 */
function chunkPlainText(text: string, budget: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < budget) {
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

const HEADING_PATTERN = /^#{1,6}\s/;

/**
 * Splits markdown into sections at heading lines so chunk boundaries align
 * with the document structure. Headings stay attached to their section body.
 */
function splitMarkdownSections(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (HEADING_PATTERN.test(line) && current.some((l) => l.trim().length > 0)) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim().length > 0)) {
    sections.push(current.join("\n"));
  }
  return sections;
}

/**
 * Markdown-aware chunking: splits on headings first, then applies size-based
 * chunking within each section. Total output is capped.
 */
export function chunkMarkdown(markdown: string): string[] {
  const chunks: string[] = [];
  for (const section of splitMarkdownSections(markdown)) {
    const remaining = MAX_CHUNKS_PER_DOCUMENT - chunks.length;
    if (remaining <= 0) break;
    chunks.push(...chunkPlainText(section, remaining));
  }
  return chunks;
}
