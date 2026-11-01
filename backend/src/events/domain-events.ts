export interface RFQDomainEventPayload {
  rfqId: string;
  organizationId: string;
  userId: string;
}

export interface FormDomainEventPayload {
  formId: string;
  submissionId: string;
  organizationId: string;
}

export interface SupportDomainEventPayload {
  ticketId: string;
  organizationId: string;
  /** Ticket channel ("chat", "whatsapp", "phone", …) so listeners can filter without a lookup. */
  channel: string;
  /** Present for `support.message_received`: the visitor message that fired the event. */
  messageId?: string;
}

export interface EmailReplySentPayload {
  emailId: string;
  inReplyToEmailId: string | null;
  threadId: string | null;
  kind: "reply" | "reply_all" | "forward";
  to: string;
  subject: string;
  gmailMessageId: string;
  organizationId: string;
  userId: string;
}

export interface DomainEventMap {
  "admin.notification_sample.requested": {
    organizationId: string;
    recipientUserId: string;
    title: string;
    body?: string | null;
    actionUrl?: string | null;
    actorUserId?: string | null;
  };
  "rfq.identified": RFQDomainEventPayload;
  "rfq.draft_saved": RFQDomainEventPayload;
  "rfq.order_placed": RFQDomainEventPayload;
  "rfq.quote_sent": RFQDomainEventPayload;
  "rfq.archived": RFQDomainEventPayload;
  "form.submitted": FormDomainEventPayload;
  "support.ticket_created": SupportDomainEventPayload;
  "support.message_received": SupportDomainEventPayload;
  "support.ticket_resolved": SupportDomainEventPayload;
  "email.reply_sent": EmailReplySentPayload;
}

type DomainEventName = keyof DomainEventMap;
type DomainEventHandler<TEventName extends DomainEventName> = (
  payload: DomainEventMap[TEventName]
) => void | Promise<void>;

const handlers = new Map<DomainEventName, Set<DomainEventHandler<any>>>();

export function registerDomainEventHandler<TEventName extends DomainEventName>(
  eventName: TEventName,
  handler: DomainEventHandler<TEventName>
): void {
  const eventHandlers = handlers.get(eventName) ?? new Set();
  eventHandlers.add(handler);
  handlers.set(eventName, eventHandlers);
}

export async function emitDomainEvent<TEventName extends DomainEventName>(
  eventName: TEventName,
  payload: DomainEventMap[TEventName]
): Promise<void> {
  const eventHandlers = handlers.get(eventName);
  if (!eventHandlers?.size) return;

  await Promise.all(
    [...eventHandlers].map(async (handler) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`Domain event handler failed for ${String(eventName)}:`, err);
      }
    })
  );
}
