import sanitizeHtml from "sanitize-html";
import { Email, type EmailKind, type IEmail } from "../models/email.model";
import type { IGmailAccount } from "../models/gmail-account.model";
import { getAttachment, getEmailById } from "./email.service";
import {
  htmlToPlainText,
  splitAddressList,
  type GmailAttachment,
} from "./gmail-send.service";
import { getObjectBuffer } from "./storage.service";
import {
  EMAIL_ATTACHMENT_MAX_TOTAL_SIZE,
  isBlockedAttachmentFilename,
} from "../config/upload-constraints.config";

export interface DerivedRecipients {
  to: string;
  cc: string | null;
}

export function extractAddress(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().replace(/^mailto:/i, "").toLowerCase();
}

/**
 * Reply targets Reply-To when the sender set one; mailing lists and ticketing
 * systems rely on it, and replying to From would reach the wrong inbox.
 *
 * When the anchor is one of our own sent messages, From and Reply-To are both
 * the account itself, so replying to them would address the user. Gmail instead
 * reuses the recipients of that message, which is what an outbound anchor does
 * here.
 */
export function deriveRecipients(
  email: Pick<IEmail, "from" | "to" | "cc" | "replyTo" | "subject" | "direction">,
  kind: EmailKind,
  accountAddress: string
): DerivedRecipients {
  if (kind === "forward") return { to: "", cc: null };

  const isOutbound = email.direction === "outbound";
  const recipients = splitAddressList(email.to ?? "");

  // An outbound anchor has no meaningful sender to reply to, so the people it
  // was addressed to become the primary recipients.
  const primary = isOutbound
    ? recipients.join(", ")
    : (email.replyTo || email.from || "").trim();

  if (kind === "reply") return { to: primary, cc: null };

  const excluded = new Set(
    [accountAddress, extractAddress(primary), isOutbound ? "" : extractAddress(email.from)]
      .map((address) => address.toLowerCase())
      .filter(Boolean)
  );

  // Outbound To addresses are already the primary recipients, so only Cc is
  // left to carry over.
  const carried = isOutbound
    ? splitAddressList(email.cc ?? "")
    : [...recipients, ...splitAddressList(email.cc ?? "")];

  const seen = new Set<string>();
  const cc: string[] = [];

  // Bcc is deliberately never carried over: those recipients were hidden.
  for (const candidate of carried) {
    const address = extractAddress(candidate);
    if (!address || excluded.has(address) || seen.has(address)) continue;
    seen.add(address);
    cc.push(candidate);
  }

  return { to: primary, cc: cc.length > 0 ? cc.join(", ") : null };
}

/**
 * Reply-all is only meaningfully different from reply when it would actually
 * add someone, so the UI can hide the control instead of offering a duplicate.
 */
export function canReplyAll(
  email: Pick<IEmail, "from" | "to" | "cc" | "replyTo" | "subject" | "direction">,
  accountAddress: string
): boolean {
  return deriveRecipients(email, "reply_all", accountAddress).cc !== null;
}

export function normalizeSubject(subject: string, kind: EmailKind): string {
  const base = subject?.trim() || "(no subject)";
  if (kind === "forward") return /^fwd:/i.test(base) ? base : `Fwd: ${base}`;
  return /^re:/i.test(base) ? base : `Re: ${base}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayName(from: string): string {
  const match = from.match(/^\s*"?(.*?)"?\s*<[^>]+>\s*$/);
  return (match?.[1] || from || "").trim() || from;
}

function formatQuoteDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * The original body is untrusted third-party HTML. It is appended here at send
 * time and never handed to the client-side editor, which would both mangle the
 * markup and execute any embedded script in our own origin.
 */
export function buildQuotedOriginal(email: IEmail): { html: string; text: string } {
  const attribution = `On ${formatQuoteDate(new Date(email.date))}, ${displayName(email.from)} wrote:`;

  const originalHtml = email.bodyHtml
    ? sanitizeQuotedHtml(email.bodyHtml)
    : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(email.bodyText ?? "")}</pre>`;

  const html = [
    `<div class="inboundr_quote">`,
    `<p style="color:#5f6368;font-size:12px;margin:16px 0 8px">${escapeHtml(attribution)}</p>`,
    `<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:2px solid #dadce0;color:#5f6368">`,
    originalHtml,
    `</blockquote>`,
    `</div>`,
  ].join("\n");

  const originalText = email.bodyText ?? (email.bodyHtml ? htmlToPlainText(email.bodyHtml) : "");
  const text = [
    "",
    attribution,
    ...originalText.split("\n").map((line) => `> ${line}`),
  ].join("\n");

  return { html, text };
}

const QUOTE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img", "font", "center", "style", "table", "thead", "tbody", "tfoot",
    "tr", "td", "th", "caption", "colgroup", "col", "u", "s", "strike",
  ]),
  allowedAttributes: {
    "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "class", "dir"],
    a: ["href", "name", "target", "rel", "style"],
    img: ["src", "alt", "width", "height", "style"],
    table: ["border", "cellpadding", "cellspacing", "style", "width", "align", "bgcolor"],
    td: ["colspan", "rowspan", "style", "width", "height", "align", "valign", "bgcolor"],
    th: ["colspan", "rowspan", "style", "width", "height", "align", "valign", "bgcolor"],
    font: ["face", "size", "color"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "cid", "data"] },
  allowVulnerableTags: true,
};

function sanitizeQuotedHtml(html: string): string {
  return sanitizeHtml(html, QUOTE_SANITIZE_OPTIONS);
}

const COLOR_VALUE_RE = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

/**
 * The composer body arrives over HTTP, so the editor's own schema is not a
 * security boundary. Restrict it to what the TipTap toolbar can actually emit.
 */
export function sanitizeComposedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike",
      "a", "ul", "ol", "li", "blockquote", "code", "pre", "h1", "h2", "h3",
      "h4", "h5", "h6", "hr", "img", "table", "thead", "tbody", "tr", "td", "th",
    ],
    allowedAttributes: {
      "*": ["style", "dir"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      td: ["colspan", "rowspan", "style"],
      th: ["colspan", "rowspan", "style"],
    },
    // Narrowed to the declarations the composer toolbar produces. `style` is
    // allowed broadly above, so without this it would pass through anything.
    allowedStyles: {
      "*": {
        "font-family": [/^[\w\s"',-]+$/],
        "font-size": [/^\d{1,3}(?:\.\d+)?(?:px|pt|em|rem)$/],
        color: [COLOR_VALUE_RE],
        "background-color": [COLOR_VALUE_RE],
        "text-align": [/^(?:left|right|center|justify)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // The editor is configured with allowBase64: false, so a data URI here could
    // only come from a hand-rolled request, and would bloat every stored draft.
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}

/**
 * Forwards reproduce the original inline rather than blockquoted, matching how
 * Gmail renders a forwarded message.
 */
export function buildForwardedBody(email: IEmail): { html: string; text: string } {
  const intro = buildForwardIntro(email);

  const originalHtml = email.bodyHtml
    ? sanitizeQuotedHtml(email.bodyHtml)
    : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(email.bodyText ?? "")}</pre>`;
  const originalText = email.bodyText ?? (email.bodyHtml ? htmlToPlainText(email.bodyHtml) : "");

  return {
    html: `${intro.html}\n<div class="inboundr_forwarded_body">${originalHtml}</div>`,
    text: `${intro.text}\n${originalText}`,
  };
}

export function buildForwardIntro(email: IEmail): { html: string; text: string } {
  const rows: [string, string][] = [
    ["From", email.from],
    ["Date", formatQuoteDate(new Date(email.date))],
    ["Subject", email.subject || "(no subject)"],
    ["To", email.to || ""],
  ];
  if (email.cc) rows.push(["Cc", email.cc]);

  const html = [
    `<div class="inboundr_forward">`,
    `<p style="color:#5f6368;font-size:12px;margin:16px 0 8px">---------- Forwarded message ----------</p>`,
    ...rows.map(
      ([label, value]) =>
        `<p style="color:#5f6368;font-size:12px;margin:0"><strong>${label}:</strong> ${escapeHtml(value)}</p>`
    ),
    `</div>`,
  ].join("\n");

  const text = [
    "",
    "---------- Forwarded message ----------",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
  ].join("\n");

  return { html, text };
}

export interface ResolvedAttachments {
  attachments: GmailAttachment[];
  totalBytes: number;
}

export class AttachmentError extends Error {}

/**
 * Pulls staged uploads back out of S3 and, when forwarding, re-fetches the
 * original's attachments from Gmail since those bytes never touched our storage.
 */
export async function resolveOutboundAttachments({
  account,
  draft,
  includeOriginalFrom,
}: {
  account: IGmailAccount;
  draft: IEmail;
  includeOriginalFrom?: IEmail | null;
}): Promise<ResolvedAttachments> {
  const attachments: GmailAttachment[] = [];

  for (const pending of draft.pendingAttachments ?? []) {
    if (isBlockedAttachmentFilename(pending.filename)) {
      throw new AttachmentError(`${pending.filename} cannot be sent by email`);
    }
    attachments.push({
      filename: pending.filename,
      contentType: pending.contentType,
      content: await getObjectBuffer(pending.key),
    });
  }

  if (includeOriginalFrom) {
    // Inline images go along as plain files: the outbound MIME builder has no
    // multipart/related support, and dropping them would lose pasted
    // screenshots the forwarded body refers to.
    const originals = [
      ...(includeOriginalFrom.attachments ?? []),
      ...(includeOriginalFrom.inlineImages ?? []),
    ];
    for (const original of originals) {
      if (isBlockedAttachmentFilename(original.filename)) continue;
      attachments.push({
        filename: original.filename,
        contentType: original.mimeType,
        content: await getAttachment(
          account,
          includeOriginalFrom.messageId,
          original.attachmentId
        ),
      });
    }
  }

  const totalBytes = attachments.reduce((sum, item) => sum + item.content.byteLength, 0);
  if (totalBytes > EMAIL_ATTACHMENT_MAX_TOTAL_SIZE) {
    const limitMb = Math.round(EMAIL_ATTACHMENT_MAX_TOTAL_SIZE / 1024 / 1024);
    throw new AttachmentError(`Attachments must total ${limitMb}MB or less`);
  }

  return { attachments, totalBytes };
}

/**
 * Reads the message back from Gmail after sending so the stored row carries
 * canonical ids. This is what lets outbound attachments download through the
 * existing attachment route, which resolves bytes by Gmail attachmentId.
 */
export async function persistOutboundEmail({
  account,
  draft,
  sentMessageId,
}: {
  account: IGmailAccount;
  draft: IEmail;
  sentMessageId: string;
}): Promise<IEmail> {
  const update: Record<string, unknown> = {
    sendStatus: "sent",
    sendError: null,
    pendingAttachments: [],
    messageId: sentMessageId,
  };

  try {
    const parsed = await getEmailById(account, sentMessageId);
    Object.assign(update, {
      messageId: parsed.messageId,
      threadId: parsed.threadId,
      historyId: parsed.historyId,
      rfcMessageId: parsed.rfcMessageId,
      references: parsed.references,
      inReplyTo: parsed.inReplyTo,
      replyTo: parsed.replyTo,
      from: parsed.from,
      to: parsed.to,
      cc: parsed.cc,
      bcc: parsed.bcc,
      subject: parsed.subject,
      date: new Date(parsed.date),
      bodyText: parsed.bodyText,
      bodyHtml: parsed.bodyHtml,
      snippet: parsed.snippet,
      labels: parsed.labels,
      attachments: parsed.attachments,
      inlineImages: parsed.inlineImages,
    });
  } catch (err) {
    // The message is already delivered at this point; a failed readback should
    // not surface as a send failure.
    console.error(`Failed to read back sent Gmail message ${sentMessageId}:`, err);
  }

  try {
    const updated = await Email.findByIdAndUpdate(draft._id, update, { returnDocument: "after" });
    return updated ?? draft;
  } catch (err) {
    // A thread sync running in the window between sending and this update will
    // have ingested the message itself, so claiming the id here collides. Adopt
    // the row it created rather than failing a send that already went out.
    const existing = await Email.findOne({
      gmailAccountId: account._id,
      messageId: sentMessageId,
      _id: { $ne: draft._id },
    });
    if (!existing) throw err;

    await Email.deleteOne({ _id: draft._id });
    return existing;
  }
}

/**
 * Records a message that was sent outside the composer, such as an RFQ quote,
 * so it shows up in the thread without waiting for a Gmail sync.
 */
export async function recordSentOutboundEmail({
  account,
  sourceEmail,
  sentMessageId,
  kind = "reply",
}: {
  account: IGmailAccount;
  sourceEmail: IEmail;
  sentMessageId: string;
  kind?: EmailKind;
}): Promise<IEmail | null> {
  const existing = await Email.findOne({
    gmailAccountId: account._id,
    messageId: sentMessageId,
  });
  if (existing) return existing;

  const draft = await Email.create({
    userId: sourceEmail.userId,
    ...(sourceEmail.organizationId ? { organizationId: sourceEmail.organizationId } : {}),
    gmailAccountId: account._id,
    direction: "outbound",
    kind,
    inReplyToEmailId: sourceEmail._id,
    sendStatus: "sending",
    threadId: sourceEmail.threadId,
    from: account.emailAddress,
    to: "",
    subject: sourceEmail.subject ?? "",
    date: new Date(),
    status: "processed",
  });

  return persistOutboundEmail({ account, draft, sentMessageId });
}
