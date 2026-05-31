import { getGmailClientForAccount } from "../config/gmail.config";
import type { IEmail } from "../models/email.model";
import type { IGmailAccount } from "../models/gmail-account.model";

type GmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function normalizeReplySubject(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject || "(no subject)"}`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildTextMimeMessage(headers: string[], body: string, attachments: GmailAttachment[] = []): string {
  if (attachments.length === 0) return `${headers.join("\r\n")}\r\n\r\n${body}`;

  const boundary = `btsa_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
    ...attachments.flatMap((attachment) => [
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n"),
    ]),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function sendStandaloneEmail({
  account,
  to,
  subject,
  body,
  attachments = [],
}: {
  account: IGmailAccount;
  to: string;
  subject: string;
  body: string;
  attachments?: GmailAttachment[];
}): Promise<string | null> {
  const gmail = await getGmailClientForAccount(account);
  const headers = [
    `From: ${account.emailAddress}`,
    `To: ${to}`,
    `Subject: ${subject || "(no subject)"}`,
    "MIME-Version: 1.0",
  ];
  if (attachments.length === 0) headers.push("Content-Type: text/plain; charset=UTF-8");
  const message = buildTextMimeMessage(headers, body, attachments);
  const raw = base64UrlEncode(message);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return res.data.id ?? null;
}

function buildReferences(email: IEmail): string | undefined {
  const values = [email.references, email.inReplyTo, email.rfcMessageId]
    .filter(Boolean)
    .join(" ")
    .trim();
  return values || undefined;
}

export async function sendQuoteOnGmailThread({
  account,
  email,
  to,
  subject,
  body,
  attachments = [],
}: {
  account: IGmailAccount;
  email: IEmail;
  to: string;
  subject: string;
  body: string;
  attachments?: GmailAttachment[];
}): Promise<string | null> {
  const gmail = await getGmailClientForAccount(account);
  const headers = [
    `From: ${account.emailAddress}`,
    `To: ${to}`,
    `Subject: ${normalizeReplySubject(subject)}`,
    "MIME-Version: 1.0",
  ];

  if (email.rfcMessageId) {
    headers.push(`In-Reply-To: ${email.rfcMessageId}`);
  }

  const references = buildReferences(email);
  if (references) {
    headers.push(`References: ${references}`);
  }

  if (attachments.length === 0) headers.push("Content-Type: text/plain; charset=UTF-8");
  const raw = base64UrlEncode(buildTextMimeMessage(headers, body, attachments));
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: email.threadId,
    },
  });

  return res.data.id ?? null;
}
