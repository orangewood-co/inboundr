import type { IGmailAccount } from "../models/gmail-account.model";
import type { IEmail } from "../models/email.model";
import { getGmailClientForAccount } from "../config/gmail.config";
import {
  extractRFQAttachmentText,
  getSupportedRFQAttachments,
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

  return sections.join("\n\n");
}
