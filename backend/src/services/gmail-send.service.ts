import { getGmailClientForAccount } from "../config/gmail.config";
import type { IEmail } from "../models/email.model";
import type { IGmailAccount } from "../models/gmail-account.model";

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
}: {
  account: IGmailAccount;
  email: IEmail;
  to: string;
  subject: string;
  body: string;
}): Promise<string | null> {
  const gmail = await getGmailClientForAccount(account);
  const headers = [
    `From: ${account.emailAddress}`,
    `To: ${to}`,
    `Subject: ${normalizeReplySubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];

  if (email.rfcMessageId) {
    headers.push(`In-Reply-To: ${email.rfcMessageId}`);
  }

  const references = buildReferences(email);
  if (references) {
    headers.push(`References: ${references}`);
  }

  const raw = base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${body}`);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: email.threadId,
    },
  });

  return res.data.id ?? null;
}
