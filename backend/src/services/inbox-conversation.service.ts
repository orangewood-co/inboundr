import type mongoose from "mongoose";

import { WHATSAPP_SERVICE_WINDOW_MS } from "../config/whatsapp.config";
import { InboxConversation, type IInboxConversation } from "../models/inbox-conversation.model";
import { InboxMessage, type IInboxMessage } from "../models/inbox-message.model";
import { RFQ } from "../models/rfq.model";
import { RFQReply } from "../models/rfq-reply.model";
import { WhatsAppAccount } from "../models/whatsapp-account.model";
import { createPresignedViewUrl } from "./storage.service";
import { isWithinServiceWindow } from "./whatsapp-rfq.service";

export interface InboxScope {
  userId: string;
  organizationId: mongoose.Types.ObjectId;
}

export type InboxClassificationFilter = "all" | "rfq" | "not_rfq" | "pending" | "failed";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Conversations the list's search and attachment narrowing apply to. */
export function conversationScopeFilter(
  scope: InboxScope,
  options: { search: string; withAttachments: boolean }
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    organizationId: scope.organizationId,
    userId: scope.userId,
    isArchived: { $ne: true },
  };
  if (options.withAttachments) filter.hasAttachments = true;
  if (options.search) {
    const pattern = { $regex: escapeRegex(options.search), $options: "i" };
    filter.$or = [{ "participant.name": pattern }, { externalId: pattern }, { snippet: pattern }];
  }
  return filter;
}

export const CONVERSATION_RFQ_CONDITION = { rfqId: { $ne: null } };

export async function conversationClassificationCondition(
  scope: InboxScope,
  filter: InboxClassificationFilter
): Promise<Record<string, unknown> | null> {
  switch (filter) {
    case "rfq":
      return CONVERSATION_RFQ_CONDITION;
    case "pending":
      return {
        $or: [{ rfqDueAt: { $type: "date" } }, { rfqProcessingStartedAt: { $type: "date" } }],
      };
    case "failed": {
      const failedRfqIds = await RFQ.find({
        userId: scope.userId,
        organizationId: scope.organizationId,
        source: "whatsapp",
        errorMessage: { $ne: null },
      }).distinct("_id");
      return { $or: [{ rfqErrorMessage: { $ne: null } }, { rfqId: { $in: failedRfqIds } }] };
    }
    case "not_rfq":
      return { rfqId: null, "lastClassification.isRFQ": false, rfqErrorMessage: null };
    default:
      return null;
  }
}

/** Whether the Inbox should offer channel filtering for this user. */
export async function hasWhatsAppInbox(scope: InboxScope): Promise<boolean> {
  const [conversation, account] = await Promise.all([
    InboxConversation.exists({ organizationId: scope.organizationId, userId: scope.userId }),
    WhatsAppAccount.exists({ organizationId: scope.organizationId, purpose: "rfq" }),
  ]);
  return Boolean(conversation || account);
}

type ConversationLike = Pick<
  IInboxConversation,
  | "_id"
  | "externalId"
  | "participant"
  | "snippet"
  | "lastMessageAt"
  | "messageCount"
  | "hasAttachments"
  | "rfqId"
  | "rfqDueAt"
  | "rfqProcessingStartedAt"
  | "lastClassification"
  | "rfqErrorMessage"
  | "customerId"
>;

type RFQSummary = { _id: unknown; reason?: string | null; errorMessage?: string | null; isProcessed?: boolean };

/** List row for a WhatsApp chat, shaped like an email row plus channel fields. */
export function serializeConversationRow(conversation: ConversationLike, rfq: RFQSummary | null | undefined) {
  const rfqErrorMessage = conversation.rfqErrorMessage ?? rfq?.errorMessage ?? null;
  const isProcessing = Boolean(
    conversation.rfqDueAt || conversation.rfqProcessingStartedAt || (rfq && rfq.isProcessed === false)
  );
  return {
    _id: String(conversation._id),
    channel: "whatsapp" as const,
    from: conversation.participant?.name?.trim() || conversation.externalId,
    participantName: conversation.participant?.name?.trim() || null,
    phoneNumber: conversation.externalId,
    customerId: conversation.customerId ? String(conversation.customerId) : null,
    subject: "",
    snippet: conversation.snippet || null,
    date: conversation.lastMessageAt,
    status: rfqErrorMessage ? "failed" : isProcessing ? "processing" : "processed",
    labels: [],
    attachments: [],
    hasAttachments: Boolean(conversation.hasAttachments),
    threadCount: conversation.messageCount,
    rfqId: conversation.rfqId ? String(conversation.rfqId) : null,
    isRFQ: conversation.rfqId ? true : conversation.lastClassification?.isRFQ ?? null,
    classificationReason: rfq?.reason ?? conversation.lastClassification?.reason ?? null,
    rfqErrorMessage,
  };
}

export async function loadConversationRows(ids: mongoose.Types.ObjectId[]) {
  if (ids.length === 0) return new Map<string, ReturnType<typeof serializeConversationRow>>();
  const conversations = await InboxConversation.find({ _id: { $in: ids } }).lean();
  const rfqIds = conversations.flatMap((conversation) => (conversation.rfqId ? [conversation.rfqId] : []));
  const rfqs = rfqIds.length
    ? await RFQ.find({ _id: { $in: rfqIds } }).select("reason errorMessage isProcessed").lean()
    : [];
  const rfqById = new Map(rfqs.map((rfq) => [String(rfq._id), rfq]));
  return new Map(
    conversations.map((conversation) => [
      String(conversation._id),
      serializeConversationRow(
        conversation,
        conversation.rfqId ? rfqById.get(String(conversation.rfqId)) : null
      ),
    ])
  );
}

const DETAIL_MESSAGE_LIMIT = 300;

export async function serializeInboxMessage(message: IInboxMessage | any) {
  const attachments = await Promise.all(
    (message.attachments ?? []).map(async (attachment: any) => {
      let url: string | null = null;
      try {
        url = (await createPresignedViewUrl(attachment.key)).url;
      } catch {
        url = null;
      }
      return {
        key: attachment.key,
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        size: attachment.size,
        url,
      };
    })
  );
  return {
    _id: String(message._id),
    direction: message.direction,
    type: message.type,
    bodyText: message.bodyText ?? "",
    attachments,
    sentAt: message.sentAt,
    authorUserId: message.authorUserId ?? null,
    deliveryStatus: message.deliveryStatus ?? null,
    deliveryError: message.deliveryError ?? null,
    rfqId: message.rfqId ? String(message.rfqId) : null,
  };
}

/** The chat as the Inbox detail panel shows it. */
export async function serializeConversationDetail(conversation: IInboxConversation) {
  const [messages, rfq] = await Promise.all([
    InboxMessage.find({ conversationId: conversation._id })
      .sort({ sentAt: -1 })
      .limit(DETAIL_MESSAGE_LIMIT)
      .lean(),
    conversation.rfqId
      ? RFQ.findById(conversation.rfqId)
          .select("reason errorMessage isProcessed workflowStatus isArchived queryProducts")
          .lean()
      : null,
  ]);
  messages.reverse();
  const quoteSent = rfq ? Boolean(await RFQReply.exists({ rfqId: rfq._id, sendStatus: "sent" })) : false;
  const lastInboundAt = conversation.lastInboundAt ?? null;

  return {
    conversation: {
      ...serializeConversationRow(conversation, rfq),
      lastInboundAt,
      windowOpen: isWithinServiceWindow(conversation),
      windowClosesAt: lastInboundAt
        ? new Date(new Date(lastInboundAt).getTime() + WHATSAPP_SERVICE_WINDOW_MS)
        : null,
      rfq: rfq
        ? {
            _id: String(rfq._id),
            isProcessed: rfq.isProcessed,
            errorMessage: rfq.errorMessage ?? null,
            workflowStatus: rfq.workflowStatus ?? "new",
            isArchived: Boolean(rfq.isArchived),
            productCount: rfq.queryProducts?.length ?? 0,
            quoteSent,
          }
        : null,
    },
    messages: await Promise.all(messages.map(serializeInboxMessage)),
  };
}
