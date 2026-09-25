import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  archiveThread,
  getAttachment,
  processHistoryUpdate,
  syncThread,
} from "../services/email.service";
import {
  Email,
  type EmailDirection,
  type EmailKind,
  type IEmail,
} from "../models/email.model";
import { GmailAccount, type IGmailAccount } from "../models/gmail-account.model";
import { RFQ } from "../models/rfq.model";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { streamEmailPdf } from "../services/email-pdf.service";
import { resolveOrganizationPdfBranding } from "../services/organization-pdf-branding.service";
import { buildRFQProcessingInput, hasRFQProcessableContent } from "../services/rfq-input.service";
import { processEmailForRFQ } from "../services/rfq.service";
import { buildReferences, sendComposedMessage } from "../services/gmail-send.service";
import {
  AttachmentError,
  buildForwardedBody,
  buildQuotedOriginal,
  canReplyAll,
  deriveRecipients,
  normalizeSubject,
  persistOutboundEmail,
  resolveOutboundAttachments,
  sanitizeComposedHtml,
} from "../services/email-reply.service";
import {
  EMAIL_ATTACHMENT_ALLOWED_MIME_TYPES,
  EMAIL_ATTACHMENT_MAX_FILE_SIZE,
  isBlockedAttachmentFilename,
} from "../config/upload-constraints.config";
import { GUIDANCE_MAX_LENGTH, generateReplyDraft } from "../services/email-ai.service";
import { emitDomainEvent } from "../events/domain-events";
import { GMAIL_SEND_SCOPE } from "../config/gmail.config";

const INLINE_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeAttachmentFilename(filename: string): string {
  return filename.replace(/[\r\n"\\]/g, "_").trim() || "attachment";
}

function buildContentDisposition(filename: string, forceDownload: boolean): string {
  const disposition = forceDownload ? "attachment" : "inline";
  const safeFilename = sanitizeAttachmentFilename(filename);
  const encodedFilename = encodeURIComponent(safeFilename);

  return `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function attachClassification(email: any, rfq: any | undefined, gmailAccountEmail: string | null = null) {
  return {
    ...email,
    gmailAccountEmail,
    rfqId: rfq?._id ?? null,
    isRFQ: rfq?.isRFQ ?? null,
    classificationReason: rfq?.reason ?? null,
    rfqErrorMessage: rfq?.errorMessage ?? null,
  };
}

export const emailWebhookController = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).send();

  try {
    const message = req.body?.message;
    if (!message?.data) {
      console.warn("Webhook received with no message data");
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8")
    );

    const { emailAddress, historyId } = decoded;

    if (!historyId) {
      console.warn("Webhook message missing historyId");
      return;
    }

    console.log(
      `Gmail Notification: ${emailAddress}, historyId: ${historyId}`
    );

    if (!emailAddress) {
      console.warn("Webhook message missing emailAddress");
      return;
    }

    const account = await GmailAccount.findOne({
      emailAddress: String(emailAddress).toLowerCase(),
      status: "connected",
    });

    if (!account) {
      console.warn(`No connected Gmail account found for ${emailAddress}`);
      return;
    }

    await processHistoryUpdate(account, historyId);
  } catch (err) {
    console.error("Error processing Gmail webhook:", err);
  }
};

// ── Inbox listing ────────────────────────────────────────────────────────────

const EMAIL_LIST_FILTERS = ["all", "rfq", "not_rfq", "pending", "failed"] as const;
type EmailListFilter = (typeof EMAIL_LIST_FILTERS)[number];

const EMAIL_SEARCH_MAX_LENGTH = 200;

function parseEmailListFilter(value: unknown): EmailListFilter {
  return EMAIL_LIST_FILTERS.includes(value as EmailListFilter)
    ? (value as EmailListFilter)
    : "all";
}

function parseBooleanFlag(value: unknown): boolean {
  return value === "1" || value === "true";
}

function parseSearchQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, EMAIL_SEARCH_MAX_LENGTH) : "";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One row per Gmail conversation: the newest inbound message represents the
// thread. Legacy rows without a threadId stay as standalone rows.
const THREAD_KEY_EXPR = {
  account: "$gmailAccountId",
  thread: { $ifNull: ["$threadId", { $toString: "$_id" }] },
};

async function countThreads(match: Record<string, unknown>): Promise<number> {
  const rows = await Email.aggregate([
    { $match: match },
    { $project: { gmailAccountId: 1, threadId: 1 } },
    { $group: { _id: THREAD_KEY_EXPR } },
    { $count: "total" },
  ]).allowDiskUse(true);
  return rows[0]?.total ?? 0;
}

interface RFQClassificationSets {
  /** Emails whose own RFQ row is a positive classification. */
  rfqEmailIds: mongoose.Types.ObjectId[];
  /** Threads holding at least one positive classification. */
  rfqThreadIds: string[];
  /** Emails whose RFQ row recorded a processing error. */
  failedEmailIds: mongoose.Types.ObjectId[];
}

/**
 * Classification lives on the RFQ collection, and the list pipeline has to
 * filter before it paginates, so the (small) positive and failed sets are
 * loaded up front and matched by id. Mirrors resolveRFQ below: an email counts
 * as an RFQ if its own row or any row in its thread is positive.
 */
async function loadRFQClassificationSets(
  scope: RequestScope,
  options: { includeFailed: boolean }
): Promise<RFQClassificationSets> {
  const rows = await RFQ.find({
    userId: scope.userId,
    organizationId: scope.organizationId,
    ...(options.includeFailed
      ? { $or: [{ isRFQ: true }, { errorMessage: { $ne: null } }] }
      : { isRFQ: true }),
  })
    .select("emailId threadId isRFQ errorMessage")
    .lean();

  const sets: RFQClassificationSets = { rfqEmailIds: [], rfqThreadIds: [], failedEmailIds: [] };
  const seenThreads = new Set<string>();
  for (const row of rows) {
    if (row.isRFQ) {
      if (row.emailId) sets.rfqEmailIds.push(row.emailId);
      if (row.threadId && !seenThreads.has(row.threadId)) {
        seenThreads.add(row.threadId);
        sets.rfqThreadIds.push(row.threadId);
      }
    }
    if (row.errorMessage && row.emailId) sets.failedEmailIds.push(row.emailId);
  }
  return sets;
}

function rfqMembershipCondition(sets: RFQClassificationSets): Record<string, unknown> {
  return {
    $or: [
      { _id: { $in: sets.rfqEmailIds } },
      { threadId: { $in: sets.rfqThreadIds } },
    ],
  };
}

function classificationCondition(
  filter: EmailListFilter,
  sets: RFQClassificationSets
): Record<string, unknown> | null {
  switch (filter) {
    case "rfq":
      return rfqMembershipCondition(sets);
    case "failed":
      return { $or: [{ status: "failed" }, { _id: { $in: sets.failedEmailIds } }] };
    case "pending":
      return { status: { $in: ["received", "processing"] } };
    case "not_rfq":
      // Everything that finished processing without landing in the positive or
      // failed sets. Legacy rows without a threadId pass the $nin as intended.
      return {
        status: "processed",
        _id: { $nin: [...sets.rfqEmailIds, ...sets.failedEmailIds] },
        threadId: { $nin: sets.rfqThreadIds },
      };
    default:
      return null;
  }
}

export const listEmails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const scope = requestScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter = parseEmailListFilter(req.query.filter);
    const withAttachments = parseBooleanFlag(req.query.attachments);
    const search = parseSearchQuery(req.query.q);
    const accountId =
      typeof req.query.account === "string" && mongoose.isValidObjectId(req.query.account)
        ? new mongoose.Types.ObjectId(req.query.account)
        : null;

    // Legacy rows predate `direction`, so $ne matches them as inbound. The INBOX
    // label keeps messages the user archived in Gmail out of the list, but rows
    // ingested before labels were recorded have none, and requiring the label
    // outright would hide them.
    const inboxFilter: Record<string, unknown> = {
      userId: scope.userId,
      organizationId: scope.organizationId,
      direction: { $ne: "outbound" as const },
      $or: [
        { labels: "INBOX" },
        { labels: { $size: 0 } },
        { labels: { $exists: false } },
      ],
    };
    if (accountId) inboxFilter.gmailAccountId = accountId;
    if (withAttachments) inboxFilter["attachments.0"] = { $exists: true };

    // Search, account and attachments narrow the scope the chip counts are
    // computed over; the classification chip then narrows the page itself, so
    // a chip's count always says how many rows picking it would show.
    const scopeConditions: Record<string, unknown>[] = [inboxFilter];
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      scopeConditions.push({
        $or: [{ from: pattern }, { subject: pattern }, { snippet: pattern }],
      });
    }
    const scopeFilter: Record<string, unknown> =
      scopeConditions.length === 1 ? inboxFilter : { $and: scopeConditions };

    const classificationSets = await loadRFQClassificationSets(scope, {
      includeFailed: filter === "failed" || filter === "not_rfq",
    });

    const classification = classificationCondition(filter, classificationSets);
    const listFilter: Record<string, unknown> = classification
      ? { $and: [scopeFilter, classification] }
      : scopeFilter;

    // Sorting/grouping full documents (with bodies) blows MongoDB's 32MB
    // in-memory sort limit on large mailboxes, so the pipeline works on slim
    // key tuples only and the page of full documents is fetched afterwards.
    const [pageRows, total, rfqCount] = await Promise.all([
      Email.aggregate([
        { $match: listFilter },
        { $project: { date: 1, gmailAccountId: 1, threadId: 1 } },
        { $sort: { date: -1, _id: -1 } },
        {
          $group: {
            _id: THREAD_KEY_EXPR,
            emailId: { $first: "$_id" },
            date: { $first: "$date" },
          },
        },
        { $sort: { date: -1, emailId: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]).allowDiskUse(true),
      countThreads(listFilter),
      countThreads({ $and: [scopeFilter, rfqMembershipCondition(classificationSets)] }),
    ]);
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;

    const pageEmailIds = pageRows.map((row) => row.emailId);
    const pageDocs = await Email.find({ _id: { $in: pageEmailIds } })
      .select("-bodyText -bodyHtml")
      .lean();
    const pageDocById = new Map(
      pageDocs.map((doc) => [doc._id.toString(), doc])
    );
    const emails = pageEmailIds
      .map((id) => pageDocById.get(id.toString()))
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

    // Conversation size counts every stored message in the thread (both
    // directions), matching what the thread view will show when opened.
    const threadPairs = emails
      .filter((email) => email.threadId)
      .map((email) => ({
        gmailAccountId: email.gmailAccountId,
        threadId: email.threadId,
      }));
    const threadCountByKey = new Map<string, number>();
    if (threadPairs.length > 0) {
      const counts = await Email.aggregate([
        {
          $match: {
            userId: authReq.user.id,
            organizationId: organization._id,
            $or: threadPairs,
            messageId: { $type: "string" },
          },
        },
        {
          $group: {
            _id: { account: "$gmailAccountId", thread: "$threadId" },
            count: { $sum: 1 },
          },
        },
      ]);
      for (const row of counts) {
        threadCountByKey.set(`${row._id.account}:${row._id.thread}`, row.count);
      }
    }

    const emailIds = emails.map((email) => email._id);
    const threadIds = [...new Set(emails.map((email) => email.threadId).filter(Boolean))];
    const rfqs = await RFQ.find({
      userId: authReq.user.id,
      organizationId: organization._id,
      $or: [
        { emailId: { $in: emailIds } },
        ...(threadIds.length > 0 ? [{ threadId: { $in: threadIds } }] : []),
      ],
    })
      .select("emailId threadId gmailAccountId isRFQ reason errorMessage")
      .lean();
    const rfqByEmailId = new Map(
      rfqs.flatMap((rfq) => (rfq.emailId ? [[rfq.emailId.toString(), rfq] as const] : []))
    );
    // Thread fallback prefers a positive classification, so a stray "not RFQ"
    // row for a follow-up never masks the thread's real RFQ.
    const rfqByThreadKey = new Map<string, (typeof rfqs)[number]>();
    for (const rfq of rfqs) {
      if (!rfq.threadId) continue;
      const key = `${rfq.gmailAccountId}:${rfq.threadId}`;
      const current = rfqByThreadKey.get(key);
      if (!current || (rfq.isRFQ && !current.isRFQ)) {
        rfqByThreadKey.set(key, rfq);
      }
    }
    const resolveRFQ = (email: any) =>
      rfqByEmailId.get(email._id.toString()) ??
      (email.threadId
        ? rfqByThreadKey.get(`${email.gmailAccountId}:${email.threadId}`)
        : undefined);
    const accountIds = [...new Set(emails.map((email) => email.gmailAccountId?.toString()).filter(Boolean))];
    const accounts = await GmailAccount.find({
      _id: { $in: accountIds },
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailAddress")
      .lean();
    const accountEmailById = new Map(
      accounts.map((account) => [account._id.toString(), account.emailAddress])
    );

    res.json({
      emails: emails.map((email) => ({
        ...attachClassification(
          email,
          resolveRFQ(email),
          accountEmailById.get(email.gmailAccountId.toString()) ?? null
        ),
        threadCount: email.threadId
          ? threadCountByKey.get(`${email.gmailAccountId}:${email.threadId}`) ?? 1
          : 1,
      })),
      total,
      rfqCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing emails:", err);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
};

export const getEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }
    let rfq = await RFQ.findOne({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailId isRFQ reason errorMessage")
      .lean();
    // A reply carries no RFQ row of its own; surface the thread's RFQ instead.
    if (!rfq && email.threadId) {
      rfq = await RFQ.findOne({
        userId: authReq.user.id,
        organizationId: organization._id,
        gmailAccountId: email.gmailAccountId,
        threadId: email.threadId,
      })
        .sort({ isRFQ: -1, createdAt: -1 })
        .select("emailId isRFQ reason errorMessage")
        .lean();
    }
    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("emailAddress")
      .lean();

    res.json(attachClassification(email, rfq, account?.emailAddress ?? null));
  } catch (err) {
    console.error("Error fetching email:", err);
    res.status(500).json({ error: "Failed to fetch email" });
  }
};

export const reprocessEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
      direction: { $ne: "outbound" },
    });

    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const rfq = await RFQ.findOne({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    const hasFailedRFQ = Boolean(rfq?.errorMessage);

    if (email.status !== "failed" && !hasFailedRFQ) {
      res.status(400).json({ error: "Only failed emails can be reprocessed" });
      return;
    }

    if (!hasRFQProcessableContent(email)) {
      res.status(400).json({ error: "Email has no processable RFQ content" });
      return;
    }

    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    const body = await buildRFQProcessingInput(account, email);
    await RFQ.deleteMany({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    email.status = "processing";
    email.errorMessage = null;
    await email.save();

    processEmailForRFQ(
      email._id.toString(),
      body,
      email.messageId,
      authReq.user.id,
      account._id.toString(),
      organization._id.toString(),
      { threadId: email.threadId ?? null }
    ).catch((err) =>
      console.error(`RFQ reprocessing failed for ${email.messageId}:`, err)
    );

    res.status(202).json({ message: "RFQ reprocessing started" });
  } catch (err) {
    console.error("Error reprocessing email:", err);
    res.status(500).json({ error: "Failed to reprocess email" });
  }
};

export const downloadEmailPdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const rfq = await RFQ.findOne({
      emailId: email._id,
      userId: authReq.user.id,
      organizationId: organization._id,
    })
      .select("isRFQ reason errorMessage")
      .lean();

    const branding = await resolveOrganizationPdfBranding(organization);
    await streamEmailPdf(email, branding, rfq, res);
  } catch (err) {
    console.error("Error rendering email PDF:", err);
    res.status(500).json({ error: "Failed to render email PDF" });
  }
};

export const getEmailAttachment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const forceDownload = req.path.endsWith("/download");

    const email = await Email.findOne({
      _id: req.params.id,
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const attachment = email.attachments.find(
      (item) => item.attachmentId === req.params.attachmentId
    );
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const account = await GmailAccount.findOne({
      _id: email.gmailAccountId,
      userId: authReq.user.id,
      organizationId: organization._id,
    });
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    const data = await getAttachment(account, email.messageId, attachment.attachmentId);
    const shouldDownload =
      forceDownload || !INLINE_ATTACHMENT_MIME_TYPES.has(attachment.mimeType);

    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", data.byteLength);
    res.setHeader(
      "Content-Disposition",
      buildContentDisposition(attachment.filename, shouldDownload)
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(data);
  } catch (err) {
    console.error("Error fetching email attachment:", err);
    res.status(500).json({ error: "Failed to fetch attachment" });
  }
};

// ── Threads, drafts and sending ──────────────────────────────────────────────

const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPLY_KINDS: EmailKind[] = ["reply", "reply_all", "forward"];

interface RequestScope {
  userId: string;
  organizationId: OrganizationRequest["organization"]["_id"];
}

function requestScope(req: Request): RequestScope {
  return {
    userId: (req as AuthenticatedRequest).user.id,
    organizationId: (req as OrganizationRequest).organization._id,
  };
}

/**
 * Rows that predate the direction field have no such key, and lean() reads skip
 * schema defaults, so an absent value is resolved to inbound here. Doing it at
 * the boundary keeps every consumer from having to treat undefined as inbound.
 */
function serializeMessage(email: IEmail | Record<string, any>, accountAddress?: string) {
  const doc = "toObject" in email ? (email as IEmail).toObject() : email;
  const { pendingAttachments, ...rest } = doc as Record<string, any>;
  const direction: EmailDirection = rest.direction === "outbound" ? "outbound" : "inbound";

  return {
    ...rest,
    direction,
    pendingAttachments: pendingAttachments ?? [],
    canReplyAll: accountAddress
      ? canReplyAll({ ...(rest as IEmail), direction }, accountAddress)
      : false,
  };
}

async function loadAccountFor(
  email: IEmail,
  scope: RequestScope
): Promise<IGmailAccount | null> {
  return GmailAccount.findOne({
    _id: email.gmailAccountId,
    userId: scope.userId,
    organizationId: scope.organizationId,
  });
}

/** Sent and received messages only; drafts have no Gmail message id yet. */
async function loadThreadMessages(email: IEmail, scope: RequestScope) {
  return Email.find({
    userId: scope.userId,
    organizationId: scope.organizationId,
    gmailAccountId: email.gmailAccountId,
    threadId: email.threadId,
    messageId: { $exists: true, $ne: null },
  })
    .sort({ date: 1 })
    .lean();
}

/**
 * A reply is anchored to the newest message in the thread, which is often not
 * the one the user has selected, so drafts are matched against every message in
 * the conversation.
 */
async function loadThreadDrafts(parentIds: IEmail["_id"][], scope: RequestScope) {
  const drafts = await Email.find(
    editableDraftQuery({
      userId: scope.userId,
      organizationId: scope.organizationId,
      inReplyToEmailId: { $in: parentIds },
    })
  )
    .sort({ updatedAt: 1 })
    .lean();

  // The filter only admits `sending` rows already past the staleness cutoff, so
  // any that come back are orphaned. Report them as failed to get the client's
  // retry affordance rather than a spinner that never resolves.
  return drafts.map((draft) =>
    draft.sendStatus === "sending"
      ? {
          ...draft,
          sendStatus: "failed" as const,
          sendError: draft.sendError ?? "Sending was interrupted. Try again.",
        }
      : draft
  );
}

async function respondWithThread(
  res: Response,
  email: IEmail,
  scope: RequestScope,
  options: { account?: IGmailAccount | null; extra?: Record<string, unknown> } = {}
): Promise<void> {
  const messages = await loadThreadMessages(email, scope);
  const drafts = await loadThreadDrafts(
    [email._id, ...messages.map((message) => message._id)],
    scope
  );

  // Reply-all availability depends on the account's own address, so it can only
  // be resolved here rather than in the client.
  const account = options.account ?? (await loadAccountFor(email, scope));
  const accountAddress = account?.emailAddress;

  res.json({
    threadId: email.threadId,
    accountAddress: accountAddress ?? null,
    messages: messages.map((message) => serializeMessage(message, accountAddress)),
    drafts: drafts.map((draft) => serializeMessage(draft)),
    ...options.extra,
  });
}

export const getEmailThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const email = await Email.findOne({ _id: req.params.id, ...scope });
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    await respondWithThread(res, email, scope);
  } catch (err) {
    console.error("Error loading email thread:", err);
    res.status(500).json({ error: "Failed to load thread" });
  }
};

export const syncEmailThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const email = await Email.findOne({ _id: req.params.id, ...scope });
    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const account = await loadAccountFor(email, scope);
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    let created = 0;
    try {
      created = await syncThread(account, email.threadId);
    } catch (err) {
      // A sync failure should not blank the thread the client already has.
      console.error(`Failed to sync Gmail thread ${email.threadId}:`, err);
    }

    await respondWithThread(res, email, scope, { account, extra: { created } });
  } catch (err) {
    console.error("Error syncing email thread:", err);
    res.status(500).json({ error: "Failed to sync thread" });
  }
};

function parseKind(value: unknown): EmailKind | null {
  return REPLY_KINDS.includes(value as EmailKind) ? (value as EmailKind) : null;
}

function normalizeAttachmentInput(value: unknown): {
  attachments: { key: string; filename: string; contentType: string; size: number }[];
  error: string | null;
} {
  if (value === undefined) return { attachments: [], error: null };
  if (!Array.isArray(value)) return { attachments: [], error: "Attachments must be a list" };

  const attachments = [];
  for (const item of value) {
    const key = String((item as any)?.key ?? "").trim();
    const filename = String((item as any)?.filename ?? "").trim();
    const contentType = String((item as any)?.contentType ?? "").trim().toLowerCase();
    const size = Number((item as any)?.size ?? 0);

    if (!key || !filename) return { attachments: [], error: "Attachment is missing a key or name" };
    if (!(EMAIL_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(contentType)) {
      return { attachments: [], error: `${filename} is not an allowed file type` };
    }
    if (isBlockedAttachmentFilename(filename)) {
      return { attachments: [], error: `${filename} cannot be sent by email` };
    }
    if (!Number.isFinite(size) || size <= 0 || size > EMAIL_ATTACHMENT_MAX_FILE_SIZE) {
      const limitMb = Math.round(EMAIL_ATTACHMENT_MAX_FILE_SIZE / 1024 / 1024);
      return { attachments: [], error: `${filename} must be ${limitMb}MB or smaller` };
    }

    attachments.push({ key, filename, contentType, size });
  }

  return { attachments, error: null };
}

function applyDraftFields(draft: IEmail, body: Record<string, unknown>): string | null {
  if (typeof body.to === "string") draft.to = body.to.trim();
  if (typeof body.cc === "string") draft.cc = body.cc.trim() || null;
  if (typeof body.bcc === "string") draft.bcc = body.bcc.trim() || null;
  if (typeof body.subject === "string") draft.subject = body.subject;
  if (typeof body.bodyHtml === "string") {
    draft.bodyHtml = sanitizeComposedHtml(body.bodyHtml);
  }

  if (body.pendingAttachments !== undefined) {
    const { attachments, error } = normalizeAttachmentInput(body.pendingAttachments);
    if (error) return error;
    draft.pendingAttachments = attachments;
  }

  return null;
}

export const createEmailDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const kind = parseKind((req.body ?? {}).kind);
    if (!kind) {
      res.status(400).json({ error: "A reply kind of reply, reply_all or forward is required" });
      return;
    }

    const parent = await Email.findOne({ _id: req.params.id, ...scope });
    if (!parent) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    const account = await loadAccountFor(parent, scope);
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    const derived = deriveRecipients(parent, kind, account.emailAddress);
    const draft = new Email({
      userId: scope.userId,
      organizationId: scope.organizationId,
      gmailAccountId: parent.gmailAccountId,
      direction: "outbound",
      kind,
      inReplyToEmailId: parent._id,
      sendStatus: "draft",
      // Forwards start a new conversation, so they carry no thread.
      threadId: kind === "forward" ? undefined : parent.threadId,
      from: account.emailAddress,
      to: derived.to,
      cc: derived.cc,
      subject: normalizeSubject(parent.subject, kind),
      date: new Date(),
      status: "processed",
    });

    const validationError = applyDraftFields(draft, req.body ?? {});
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    await draft.save();
    res.status(201).json(serializeMessage(draft));
  } catch (err) {
    console.error("Error creating email draft:", err);
    res.status(500).json({ error: "Failed to create draft" });
  }
};

/**
 * A send flips the row to `sending` before calling Gmail. If the process dies in
 * between, nothing ever moves it on, and a row in that state is matched by no
 * endpoint, so the user loses the reply with no way to reach it. Past this age
 * the row is treated as orphaned and becomes editable again.
 */
const STALE_SENDING_AFTER_MS = 2 * 60 * 1000;

function editableDraftQuery<T extends object>(base: T) {
  return {
    ...base,
    direction: "outbound" as const,
    $or: [
      { sendStatus: { $in: ["draft", "failed"] as const } },
      {
        sendStatus: "sending" as const,
        updatedAt: { $lt: new Date(Date.now() - STALE_SENDING_AFTER_MS) },
      },
    ],
  };
}

async function loadDraft(req: Request, scope: RequestScope): Promise<IEmail | null> {
  return Email.findOne(editableDraftQuery({ _id: req.params.draftId, ...scope }));
}

export const updateEmailDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const draft = await loadDraft(req, scope);
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const validationError = applyDraftFields(draft, req.body ?? {});
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    draft.sendStatus = "draft";
    draft.sendError = null;
    await draft.save();
    res.json(serializeMessage(draft));
  } catch (err) {
    console.error("Error updating email draft:", err);
    res.status(500).json({ error: "Failed to update draft" });
  }
};

export const generateEmailReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const draft = await loadDraft(req, scope);
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    if (draft.kind === "forward") {
      res.status(400).json({ error: "AI drafting is only available for replies" });
      return;
    }

    // Replies always carry the parent's threadId, so the draft itself is enough
    // to load the conversation. Drafts are excluded by the messageId filter.
    const messages = draft.threadId ? await loadThreadMessages(draft, scope) : [];
    if (messages.length === 0) {
      res.status(400).json({ error: "There is no message to reply to yet" });
      return;
    }

    const guidance = String(req.body?.guidance ?? "")
      .trim()
      .slice(0, GUIDANCE_MAX_LENGTH);

    const { bodyHtml } = await generateReplyDraft({
      messages,
      subject: draft.subject ?? "",
      to: draft.to ?? "",
      accountAddress: draft.from,
      guidance: guidance || undefined,
    });

    res.json({ bodyHtml });
  } catch (err) {
    console.error("Error generating AI email reply:", err);
    res.status(500).json({ error: "Failed to generate a reply. Try again." });
  }
};

export const deleteEmailDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = requestScope(req);
    const draft = await loadDraft(req, scope);
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    await draft.deleteOne();
    res.json({ deleted: true });
  } catch (err) {
    console.error("Error deleting email draft:", err);
    res.status(500).json({ error: "Failed to delete draft" });
  }
};

export const sendEmailDraft = async (req: Request, res: Response): Promise<void> => {
  const scope = requestScope(req);
  let draft: IEmail | null = null;
  // Tracks whether Gmail accepted the message, so a later failure is never
  // reported as a retryable send.
  let deliveredMessageId: string | null = null;

  try {
    draft = await loadDraft(req, scope);
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    // Accept a final round of edits so an unflushed autosave is not lost.
    const validationError = applyDraftFields(draft, req.body ?? {});
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const recipients = (draft.to ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      res.status(400).json({ error: "At least one recipient is required" });
      return;
    }

    const invalid = recipients.find((value) => {
      const address = value.match(/<([^>]+)>/)?.[1] ?? value;
      return !EMAIL_ADDRESS_RE.test(address.trim());
    });
    if (invalid) {
      res.status(400).json({ error: `${invalid} is not a valid email address` });
      return;
    }

    const account = await loadAccountFor(draft, scope);
    if (!account) {
      res.status(404).json({ error: "Gmail account not found" });
      return;
    }

    // Accounts linked before sending was supported hold only the readonly scope.
    // Gmail answers those with a bare 403, so name the remedy up front.
    if (!account.scope.includes(GMAIL_SEND_SCOPE)) {
      res.status(403).json({
        error: `${account.emailAddress} was connected without permission to send mail. Reconnect the account in Settings to grant it.`,
      });
      return;
    }

    const parent = draft.inReplyToEmailId
      ? await Email.findOne({ _id: draft.inReplyToEmailId, ...scope })
      : null;

    const kind = draft.kind ?? "reply";
    const composedHtml = draft.bodyHtml ?? "";
    let html = composedHtml;

    if (parent) {
      const appended =
        kind === "forward" ? buildForwardedBody(parent) : buildQuotedOriginal(parent);
      html = `${composedHtml}\n${appended.html}`;
    }

    let attachments;
    try {
      const resolved = await resolveOutboundAttachments({
        account,
        draft,
        includeOriginalFrom: kind === "forward" ? parent : null,
      });
      attachments = resolved.attachments;
    } catch (err) {
      if (err instanceof AttachmentError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    draft.sendStatus = "sending";
    draft.sendError = null;
    await draft.save();

    const isThreadedReply = kind !== "forward" && Boolean(parent);

    const sentMessageId = await sendComposedMessage({
      account,
      threadId: isThreadedReply ? parent!.threadId : null,
      headers: {
        From: account.emailAddress,
        To: draft.to,
        Cc: draft.cc ?? undefined,
        Bcc: draft.bcc ?? undefined,
        Subject: draft.subject || "(no subject)",
        "In-Reply-To": isThreadedReply ? parent!.rfcMessageId ?? undefined : undefined,
        References: isThreadedReply ? buildReferences(parent!) : undefined,
      },
      html,
      attachments,
    });

    if (!sentMessageId) {
      throw new Error("Gmail did not return a message id");
    }
    deliveredMessageId = sentMessageId;

    const sent = await persistOutboundEmail({ account, draft, sentMessageId });

    // The message is already away, so a failure to archive must not fail the
    // request; report it alongside the sent message instead.
    let archiveError: string | null = null;
    if (req.body?.archive === true && parent?.threadId) {
      try {
        await archiveThread(account, parent.threadId);
      } catch (err) {
        console.error(`Failed to archive thread ${parent.threadId}:`, err);
        archiveError = err instanceof Error ? err.message : "Failed to archive the conversation";
      }
    }

    void emitDomainEvent("email.reply_sent", {
      emailId: sent._id.toString(),
      inReplyToEmailId: parent?._id.toString() ?? null,
      threadId: sent.threadId ?? null,
      kind,
      to: sent.to,
      subject: sent.subject,
      gmailMessageId: sentMessageId,
      organizationId: scope.organizationId.toString(),
      userId: scope.userId,
    });

    // The sent message becomes the thread's newest, so the client needs to know
    // whether replying-all to it would still add anyone.
    res.json({ ...serializeMessage(sent, account.emailAddress), archiveError });
  } catch (err) {
    console.error("Error sending email draft:", err);

    // Once Gmail has the message, marking the draft failed would invite a retry
    // that delivers it a second time. Record it as sent instead and let the
    // bookkeeping problem surface on its own.
    if (draft && deliveredMessageId) {
      await Email.updateOne(
        { _id: draft._id },
        { sendStatus: "sent", sendError: null, pendingAttachments: [] }
      ).catch(() => undefined);

      res.status(500).json({
        error:
          "The message was sent, but recording it failed. Refresh the conversation before replying again so it is not sent twice.",
      });
      return;
    }

    if (draft) {
      draft.sendStatus = "failed";
      draft.sendError = err instanceof Error ? err.message : "Failed to send";
      await draft.save().catch(() => undefined);
    }

    res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to send reply",
    });
  }
};
