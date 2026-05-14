import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PDFParse } from "pdf-parse";
import type { EmailAttachment } from "../types/email.types";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const MAX_PDF_PAGES = 4;
const MAX_EXTRACTED_CHARS_PER_ATTACHMENT = 12000;

const imageModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

export interface AttachmentExtractionInput {
  attachment: EmailAttachment;
  data: Buffer;
}

export interface AttachmentExtractionResult {
  filename: string;
  mimeType: string;
  text: string | null;
  warning: string | null;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isSupportedRFQAttachment(attachment: EmailAttachment): boolean {
  return (
    attachment.mimeType === "application/pdf" ||
    SUPPORTED_IMAGE_MIME_TYPES.has(attachment.mimeType)
  );
}

export function getSupportedRFQAttachments(
  attachments: EmailAttachment[]
): EmailAttachment[] {
  return attachments.filter(isSupportedRFQAttachment).slice(0, MAX_ATTACHMENTS);
}

function trimExtractedText(text: string): string {
  return text.trim().slice(0, MAX_EXTRACTED_CHARS_PER_ATTACHMENT);
}

async function extractPDFText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ first: MAX_PDF_PAGES });
    return trimExtractedText(result.text);
  } finally {
    await parser.destroy();
  }
}

async function extractImageText(input: AttachmentExtractionInput): Promise<string> {
  const dataUrl = `data:${input.attachment.mimeType};base64,${input.data.toString(
    "base64"
  )}`;

  const response = await imageModel.invoke([
    new SystemMessage(
      "Extract RFQ-relevant text from the image. Return only visible text and concise notes about products, quantities, specifications, contact details, and quote intent. If no relevant text is visible, return an empty string."
    ),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: `Attachment filename: ${input.attachment.filename}`,
        },
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    }),
  ]);

  return trimExtractedText(String(response.content ?? ""));
}

export async function extractRFQAttachmentText(
  input: AttachmentExtractionInput
): Promise<AttachmentExtractionResult> {
  const { attachment, data } = input;

  if (!isSupportedRFQAttachment(attachment)) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: "Unsupported attachment type",
    };
  }

  if (data.byteLength > MAX_ATTACHMENT_BYTES) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: `Attachment exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`,
    };
  }

  try {
    const text =
      attachment.mimeType === "application/pdf"
        ? await extractPDFText(data)
        : await extractImageText(input);

    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: text || null,
      warning: text ? null : "No text extracted from attachment",
    };
  } catch (err: any) {
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      text: null,
      warning: err?.message || "Attachment extraction failed",
    };
  }
}
