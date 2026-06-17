import { registerDomainEventHandler } from "./domain-events";
import { createNotificationForRecipient } from "../services/notification.service";

let registered = false;

export function registerNotificationEventHandlers(): void {
  if (registered) return;
  registered = true;

  registerDomainEventHandler("admin.notification_sample.requested", async (event) => {
    await createNotificationForRecipient({
      organizationId: event.organizationId,
      recipientUserId: event.recipientUserId,
      type: "admin.sample",
      title: event.title,
      body: event.body,
      actionUrl: event.actionUrl,
      actorUserId: event.actorUserId,
      entityType: "admin_notification_sample",
      metadata: {
        source: "super_admin",
      },
    });
  });
}
