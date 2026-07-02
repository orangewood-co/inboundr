/**
 * Text-like files (txt/md/json/html/...) pass through as-is; markdown files
 * are already the target format and other text formats embed acceptably raw.
 */
export function convertTextToMarkdown(data: Buffer): string {
  return data.toString("utf-8").trim();
}
