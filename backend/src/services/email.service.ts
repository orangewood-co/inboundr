import type { gmail_v1 } from "googleapis";
import { getGmailClientForAccount } from "../config/gmail.config";
import { Email } from "../models/email.model";
import type { ParsedEmail, EmailAttachment } from "../types/email.types";
import { processEmailForRFQ } from "./rfq.service";
import {
  GmailAccount,
  type IGmailAccount,
} from "../models/gmail-account.model";

export async function processHistoryUpdate(
  account: IGmailAccount,
  newHistoryId: string
): Promise<void> {
  const storedHistoryId = account.historyId;

  if (!storedHistoryId) {
    console.warn(`No stored historyId found for ${account.emailAddress}`);
    await GmailAccount.updateOne({ _id: account._id }, { historyId: newHistoryId });
    return;
  }

  if (BigInt(newHistoryId) <= BigInt(storedHistoryId)) {
    console.log("Received historyId is not newer, skipping");
    return;
  }

  const gmail = await getGmailClientForAccount(account);

  try {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId: storedHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    const histories = res.data.history ?? [];
    const messageIds = new Set<string>();

    for (const history of histories) {
      for (const added of history.messagesAdded ?? []) {
        if (added.message?.id) {
          messageIds.add(added.message.id);
        }
      }
    }

    for (const messageId of messageIds) {
      const exists = await Email.exists({
        gmailAccountId: account._id,
        messageId,
      }).lean();
      if (exists) continue;

      try {
        const parsed = await getEmailById(account, messageId);
        const saved = await saveEmail(account, parsed);
        console.log(`Saved email: ${parsed.subject} from ${parsed.from}`);

        if (saved) {
          const emailDoc = await Email.findOne({
            gmailAccountId: account._id,
            messageId,
          }).lean();
          const rawBody = emailDoc?.bodyText || emailDoc?.bodyHtml;
          if (emailDoc && rawBody) {
            const body = `SENT FROM: ${emailDoc.from}, SENT TO: ${emailDoc.to}, DATE: ${emailDoc.date}\n${rawBody}`;
            processEmailForRFQ(
              emailDoc._id.toString(),
              body,
              messageId,
              account.userId,
              account._id.toString()
            ).catch((err) =>
              console.error(`RFQ processing failed for ${messageId}:`, err)
            );
          }
        }
      } catch (err) {
        console.error(`Failed to process message ${messageId}:`, err);
      }
    }
  } catch (err: any) {
    if (err.code === 404) {
      console.warn(
        "History ID too old, fetching recent messages instead"
      );
      await fetchRecentMessages(account);
    } else {
      throw err;
    }
  }

  await GmailAccount.updateOne({ _id: account._id }, { historyId: newHistoryId });
}

export async function getEmailById(
  account: IGmailAccount,
  messageId: string
): Promise<ParsedEmail> {
  const gmail = await getGmailClientForAccount(account);

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const message = res.data;
  const headers = message.payload?.headers ?? [];

  const getHeader = (name: string): string =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    "";

  const { bodyText, bodyHtml, attachments } = parseMessagePayload(
    message.payload
  );

  return {
    messageId: message.id!,
    threadId: message.threadId!,
    historyId: message.historyId!,
    rfcMessageId: getHeader("Message-ID") || null,
    references: getHeader("References") || null,
    inReplyTo: getHeader("In-Reply-To") || null,
    from: getHeader("From"),
    to: getHeader("To"),
    cc: getHeader("Cc") || null,
    bcc: getHeader("Bcc") || null,
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    bodyText,
    bodyHtml,
    snippet: message.snippet ?? null,
    labels: message.labelIds ?? [],
    attachments,
  };
}

interface PayloadParseResult {
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: EmailAttachment[];
}

function parseMessagePayload(
  payload: gmail_v1.Schema$MessagePart | undefined
): PayloadParseResult {
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;
  const attachments: EmailAttachment[] = [];

  if (!payload) return { bodyText, bodyHtml, attachments };

  function walk(part: gmail_v1.Schema$MessagePart): void {
    const mimeType = part.mimeType ?? "";

    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType,
        size: part.body.size ?? 0,
        attachmentId: part.body.attachmentId,
      });
      return;
    }

    if (mimeType === "text/plain" && part.body?.data && !bodyText) {
      bodyText = Buffer.from(part.body.data, "base64url").toString("utf-8");
    }

    if (mimeType === "text/html" && part.body?.data && !bodyHtml) {
      bodyHtml = Buffer.from(part.body.data, "base64url").toString("utf-8");
    }

    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return { bodyText, bodyHtml, attachments };
}

export async function getAttachment(
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

  return Buffer.from(res.data.data!, "base64url");
}

export async function saveEmail(
  account: IGmailAccount,
  parsed: ParsedEmail
): Promise<boolean> {
  try {
    await Email.create({
      userId: account.userId,
      gmailAccountId: account._id,
      ...parsed,
      date: new Date(parsed.date),
      status: "received",
    });
    return true;
  } catch (err: any) {
    if (err.code === 11000) {
      // Duplicate — already saved, safe to ignore
      return false;
    }
    throw err;
  }
}

export async function updateEmailStatus(
  messageId: string,
  status: "processing" | "processed" | "failed",
  errorMessage?: string,
  gmailAccountId?: string
): Promise<void> {
  const update: Record<string, any> = { status };
  if (status === "processed") update.processedAt = new Date();
  if (errorMessage) update.errorMessage = errorMessage;

  await Email.updateOne(
    gmailAccountId ? { messageId, gmailAccountId } : { messageId },
    { $set: update }
  );
}

async function fetchRecentMessages(account: IGmailAccount): Promise<void> {
  const gmail = await getGmailClientForAccount(account);

  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 10,
  });

  for (const msg of res.data.messages ?? []) {
    if (!msg.id) continue;
    const exists = await Email.exists({
      gmailAccountId: account._id,
      messageId: msg.id,
    }).lean();
    if (exists) continue;

    try {
      const parsed = await getEmailById(account, msg.id);
      const saved = await saveEmail(account, parsed);
      console.log(`Saved recent email: ${parsed.subject} from ${parsed.from}`);
      if (saved) {
        const emailDoc = await Email.findOne({
          gmailAccountId: account._id,
          messageId: msg.id,
        }).lean();
        const rawBody = emailDoc?.bodyText || emailDoc?.bodyHtml;
        if (emailDoc && rawBody) {
          const body = `SENT FROM: ${emailDoc.from}, SENT TO: ${emailDoc.to}, DATE: ${emailDoc.date}\n${rawBody}`;
          processEmailForRFQ(
            emailDoc._id.toString(),
            body,
            msg.id,
            account.userId,
            account._id.toString()
          ).catch((err) =>
            console.error(`RFQ processing failed for ${msg.id}:`, err)
          );
        }
      }
    } catch (err) {
      console.error(`Failed to fetch message ${msg.id}:`, err);
    }
  }
}
