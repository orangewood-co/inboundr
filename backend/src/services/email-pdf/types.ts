/** A styled span of text inside a body block. */
export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mono?: boolean;
  link?: string;
};

export type TableCell = {
  runs: InlineRun[];
  header: boolean;
};

/**
 * Flat block list rather than a nested tree: quoting and list nesting are
 * carried as depth counters so the renderer can regroup them without
 * recursing through container elements that emails wrap content in.
 */
export type BodyBlock =
  | { kind: "paragraph"; runs: InlineRun[]; quoteDepth: number }
  | { kind: "heading"; level: number; runs: InlineRun[]; quoteDepth: number }
  | { kind: "listItem"; runs: InlineRun[]; marker: string; depth: number; quoteDepth: number }
  | { kind: "pre"; text: string; quoteDepth: number }
  | { kind: "rule"; quoteDepth: number }
  | { kind: "table"; rows: TableCell[][]; quoteDepth: number };

export type ParsedBody = {
  blocks: BodyBlock[];
  /** Body exceeded the render caps and was cut short. */
  truncated: boolean;
  /** The source contained images, which are never embedded. */
  hasImages: boolean;
};

export type PdfEmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
};

export type PdfEmail = {
  _id: unknown;
  from: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  date: Date | string;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  labels?: string[];
  status: string;
  attachments?: PdfEmailAttachment[];
};

export type PdfEmailClassification = {
  isRFQ?: boolean | null;
  errorMessage?: string | null;
};

export type InlineMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mono?: boolean;
  link?: string;
};
