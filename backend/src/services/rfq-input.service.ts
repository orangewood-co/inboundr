import type { IGmailAccount } from "../models/gmail-account.model";
import type { IEmail } from "../models/email.model";
import type { IRFQManualInput } from "../models/rfq.model";
import { getGmailClientForAccount } from "../config/gmail.config";
import { getObjectBuffer } from "./storage.service";
import {
  extractRFQAttachmentText,
  getSupportedRFQAttachments,
  getSupportedRFQInlineImages,
} from "./rfq-attachment.service";

type EmailForRFQInput = Pick<
  IEmail,
  | "_id"
  | "messageId"
  | "from"
  | "to"
  | "date"
  | "bodyText"
  | "bodyHtml"
  | "attachments"
  | "inlineImages"
>;

async function getAttachmentData(
  account: IGmailAccount,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const gmail = await getGmailClientForAccount(account);
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  return Buffer.from(res.data.data ?? "", "base64url");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ThreadEmailForRFQInput = Pick<
  IEmail,
  "from" | "to" | "date" | "direction" | "bodyText" | "bodyHtml"
>;

/**
 * Builds the extraction input for a reply on a thread that already has an RFQ:
 * the whole stored conversation, oldest first, with the freshly built input for
 * the new message (which already includes its attachment text) at the end.
 */
export function buildRFQThreadConversationInput(
  priorEmails: ThreadEmailForRFQInput[],
  latestMessageInput: string
): string {
  const sections = [
    "EMAIL CONVERSATION (oldest message first). The customer's request may change across messages, so extract the latest agreed state of the requested products, quantities and details. Messages labelled OUR REPLY were sent by our own team and are not the customer.",
  ];

  priorEmails.forEach((email, index) => {
    const role = email.direction === "outbound" ? "OUR REPLY" : "FROM CUSTOMER";
    const body =
      email.bodyText || (email.bodyHtml ? stripHtml(email.bodyHtml) : "");
    sections.push(
      `MESSAGE ${index + 1} (${role})\nSENT FROM: ${email.from}, SENT TO: ${email.to}, DATE: ${email.date}\n${body || "(no body)"}`
    );
  });

  sections.push(`LATEST MESSAGE (FROM CUSTOMER)\n${latestMessageInput}`);

  return sections.join("\n\n---\n\n");
}

export function hasRFQProcessableContent(email: EmailForRFQInput): boolean {
  return Boolean(
    email.bodyText ||
      email.bodyHtml ||
      getSupportedRFQAttachments(email.attachments ?? []).length > 0
  );
}

export async function buildRFQProcessingInput(
  account: IGmailAccount,
  email: EmailForRFQInput
): Promise<string> {
  const body = email.bodyText || (email.bodyHtml ? stripHtml(email.bodyHtml) : "");
  const sections = [
    `SENT FROM: ${email.from}, SENT TO: ${email.to}, DATE: ${email.date}`,
  ];

  if (body) {
    sections.push(`EMAIL BODY:\n${body}`);
  }

  const supportedAttachments = getSupportedRFQAttachments(email.attachments ?? []);
  const attachmentSections: string[] = [];

  for (const attachment of supportedAttachments) {
    const data = await getAttachmentData(account, email.messageId, attachment.attachmentId);
    const extraction = await extractRFQAttachmentText({ attachment, data });

    if (extraction.text) {
      attachmentSections.push(
        `ATTACHMENT: ${extraction.filename} (${extraction.mimeType})\n${extraction.text}`
      );
    } else if (extraction.warning) {
      attachmentSections.push(
        `ATTACHMENT: ${extraction.filename} (${extraction.mimeType})\nExtraction warning: ${extraction.warning}`
      );
    }
  }

  if (attachmentSections.length > 0) {
    sections.push(`SUPPORTED ATTACHMENTS:\n${attachmentSections.join("\n\n")}`);
  }

  const inlineImageSections: string[] = [];

  for (const image of getSupportedRFQInlineImages(email.inlineImages ?? [])) {
    const data = await getAttachmentData(account, email.messageId, image.attachmentId);
    const extraction = await extractRFQAttachmentText({ attachment: image, data });

    if (extraction.text) {
      inlineImageSections.push(
        `INLINE IMAGE: ${extraction.filename} (cid:${image.contentId})\n${extraction.text}`
      );
    } else if (extraction.warning) {
      // Logos and other decorative images extract to nothing, so the warning
      // stays out of the model input, but a failed read must still be visible.
      console.warn(
        `Inline image ${image.contentId} on email ${email.messageId} not read: ${extraction.warning}`
      );
    }
  }

  if (inlineImageSections.length > 0) {
    sections.push(
      `IMAGES EMBEDDED IN THE EMAIL BODY (the body refers to each by its cid):\n${inlineImageSections.join("\n\n")}`
    );
  }

  return sections.join("\n\n");
}

/**
 * Extraction input for a manually created RFQ: the pasted text plus text
 * extracted from files the user uploaded to S3 (same parsers as email
 * attachments — the extractor only reads filename and mimeType, so the S3 key
 * stands in for the Gmail attachment id).
 */
export async function buildManualRFQProcessingInput(
  input: IRFQManualInput
): Promise<string> {
  const sections: string[] = [];

  if (input.text?.trim()) {
    sections.push(`RFQ REQUEST (submitted manually by our team):\n${input.text.trim()}`);
  }

  const attachmentSections: string[] = [];
  for (const file of input.attachments) {
    const data = await getObjectBuffer(file.key);
    const extraction = await extractRFQAttachmentText({
      attachment: {
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        attachmentId: file.key,
      },
      data,
    });

    if (extraction.text) {
      attachmentSections.push(
        `FILE: ${extraction.filename} (${extraction.mimeType})\n${extraction.text}`
      );
    } else if (extraction.warning) {
      attachmentSections.push(
        `FILE: ${extraction.filename} (${extraction.mimeType})\nExtraction warning: ${extraction.warning}`
      );
    }
  }

  if (attachmentSections.length > 0) {
    sections.push(`UPLOADED FILES:\n${attachmentSections.join("\n\n")}`);
  }

  return sections.join("\n\n");
}
