import { htmlToPlainText } from "./rich-text.service";

const NO_REPLY_LOCAL_PART =
  /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]?daemon|postmaster|bounces?)(?:[-_.+].*)?$/i;

// Forums is deliberately absent: Gmail files Google Groups traffic there, and
// a shared support@ group is a common way mail reaches a connected inbox.
const AUTOMATED_GMAIL_CATEGORIES: Record<string, string> = {
  CATEGORY_PROMOTIONS: "Gmail Promotions category",
  CATEGORY_SOCIAL: "Gmail Social category",
};

function senderLocalPart(from: string): string {
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  return address.split("@")[0] ?? "";
}

/**
 * Cheap, deterministic screen for machine-sent mail (auto-replies, bounces,
 * newsletters, no-reply notifications) so it never opens a ticket or spends a
 * classifier call. Returns the reason, or null for mail that looks human.
 */
export function detectAutomatedEmail(input: {
  header: (name: string) => string;
  from: string;
  labels: string[];
  mimeType?: string | null;
}): string | null {
  const header = (name: string) => input.header(name).trim();

  const autoSubmitted = header("Auto-Submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return `Auto-Submitted: ${autoSubmitted}`;
  if (header("X-Autoreply") || header("X-Autorespond")) return "Auto-reply";

  if ((input.mimeType ?? "").toLowerCase() === "multipart/report" || header("Return-Path") === "<>") {
    return "Delivery status notification";
  }

  const precedence = header("Precedence").toLowerCase();
  if (precedence === "bulk" || precedence === "junk" || precedence === "auto_reply") {
    return `Precedence: ${precedence}`;
  }

  // Google Groups stamps list headers on everything it relays, including a
  // customer's mail to a shared support@ group, so those are not a signal there.
  const listHeaders = `${header("List-Id")} ${header("List-Unsubscribe")}`;
  const viaGoogleGroup =
    Boolean(header("X-Google-Group-Id")) || /googlegroups\.com|groups\.google\.com/i.test(listHeaders);
  if (!viaGoogleGroup) {
    if (precedence === "list") return "Mailing list";
    if (header("List-Unsubscribe")) return "Mailing list or newsletter";
  }

  if (NO_REPLY_LOCAL_PART.test(senderLocalPart(input.from))) return "No-reply sender";

  for (const label of input.labels) {
    const reason = AUTOMATED_GMAIL_CATEGORIES[label];
    if (reason) return reason;
  }

  return null;
}

const EMAIL_TICKET_BODY_MAX_LENGTH = 8000;

const MOBILE_FOOTER = /^(?:sent from my \w+|get outlook for (?:ios|android)|sent from (?:mail|outlook) for)/i;

function isReplyHeaderAt(lines: string[], index: number): boolean {
  const line = lines[index]!.trim();
  if (/^on\b.*\bwrote:\s*$/i.test(line)) return true;
  // Long attributions wrap onto a second line before "wrote:".
  if (/^on\b/i.test(line) && /\bwrote:\s*$/i.test(lines[index + 1]?.trim() ?? "")) return true;
  if (/^-{2,}\s*original message\s*-{2,}$/i.test(line)) return true;
  if (/^_{10,}$/.test(line) && /^from:\s/i.test(lines[index + 1]?.trim() ?? "")) return true;
  // Outlook's header block: From / Sent (or Date) on consecutive lines.
  if (/^from:\s.+/i.test(line) && /^(?:sent|date):\s/i.test(lines[index + 1]?.trim() ?? "")) return true;
  return false;
}

function isTrailingQuoteAt(lines: string[], index: number): boolean {
  if (!/^\s*>/.test(lines[index]!)) return false;
  return lines.slice(index).every((line) => !line.trim() || /^\s*>/.test(line));
}

const FORWARD_SUBJECT = /^\s*(?:fwd?|fw)\s*:/i;
const FORWARD_MARKER = /^-{5,}\s*forwarded message\s*-{5,}$/i;

/**
 * The new part of an email reply: quoted history, signatures delimited with
 * "-- ", and mobile footers are cut so the ticket timeline reads like a
 * conversation. Falls back to the whole body when nothing would be left.
 * Forwards are kept whole since the forwarded content is the point.
 */
export function extractReplyText(email: {
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
}): string {
  const source = email.bodyText?.trim()
    ? email.bodyText
    : email.bodyHtml
      ? htmlToPlainText(email.bodyHtml)
      : "";
  const full = String(source ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .trim();
  if (!full) return "";

  const lines = full.split("\n");
  const isForward = FORWARD_SUBJECT.test(email.subject ?? "");
  let end = lines.length;
  for (let index = 0; index < lines.length && !isForward; index += 1) {
    const trimmed = lines[index]!.trim();
    if (FORWARD_MARKER.test(trimmed)) break;
    if (
      isReplyHeaderAt(lines, index) ||
      isTrailingQuoteAt(lines, index) ||
      /^--\s*$/.test(lines[index]!) ||
      MOBILE_FOOTER.test(trimmed)
    ) {
      end = index;
      break;
    }
  }

  const reply = lines
    .slice(0, end)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const text = reply || full;
  return text.length > EMAIL_TICKET_BODY_MAX_LENGTH
    ? `${text.slice(0, EMAIL_TICKET_BODY_MAX_LENGTH).trimEnd()}\n\n[Message truncated]`
    : text;
}
