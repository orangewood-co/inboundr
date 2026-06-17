import mongoose, { type Types } from "mongoose";
import { Notification, type INotification } from "../models/notification.model";
import { OrganizationMember } from "../models/organization-member.model";
import { shouldDeliverNotification } from "./notification-preference.service";
import {
  broadcastNotificationCreated,
  broadcastNotificationReadAll,
  broadcastNotificationUpdated,
} from "./notification-ws.service";

export interface SerializedNotification {
  _id: string;
  organizationId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  actorUserId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  organizationId: Types.ObjectId | string;
  recipientUserId: string;
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
}

export interface ListNotificationsInput {
  organizationId: Types.ObjectId | string;
  userId: string;
  cursor?: string | null;
  limit?: number;
}

function organizationObjectId(value: Types.ObjectId | string): Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function optionalString(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function serializeDate(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function serializeNotification(notification: INotification | any): SerializedNotification {
  return {
    _id: String(notification._id),
    organizationId: String(notification.organizationId),
    recipientUserId: notification.recipientUserId,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    actionUrl: notification.actionUrl ?? null,
    actorUserId: notification.actorUserId ?? null,
    entityType: notification.entityType ?? null,
    entityId: notification.entityId ?? null,
    metadata: notification.metadata ?? {},
    readAt: serializeDate(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}

export async function ensureNotificationRecipient(
  organizationId: Types.ObjectId | string,
  recipientUserId: string
): Promise<void> {
  const member = await OrganizationMember.exists({
    organizationId: organizationObjectId(organizationId),
    userId: recipientUserId,
  });
  if (!member) {
    const error = new Error("Recipient is not a member of this organization");
    (error as any).statusCode = 400;
    throw error;
  }
}

export async function createNotificationForRecipient(
  input: CreateNotificationInput
): Promise<SerializedNotification | null> {
  const organizationId = organizationObjectId(input.organizationId);
  const recipientUserId = optionalString(input.recipientUserId, 200);
  const type = optionalString(input.type, 120);
  const title = optionalString(input.title, 180);

  if (!recipientUserId || !type || !title) {
    const error = new Error("Notification recipient, type, and title are required");
    (error as any).statusCode = 400;
    throw error;
  }

  await ensureNotificationRecipient(organizationId, recipientUserId);

  const shouldDeliver = await shouldDeliverNotification({
    organizationId: String(organizationId),
    userId: recipientUserId,
    type,
    channel: "in_app",
  });
  if (!shouldDeliver) return null;

  const dedupeKey = optionalString(input.dedupeKey, 240);
  const notification = await Notification.create({
    organizationId,
    recipientUserId,
    type,
    title,
    body: optionalString(input.body, 1000),
    actionUrl: optionalString(input.actionUrl, 2048),
    actorUserId: optionalString(input.actorUserId, 200),
    entityType: optionalString(input.entityType, 120),
    entityId: optionalString(input.entityId, 200),
    metadata: input.metadata ?? {},
    ...(dedupeKey ? { dedupeKey } : {}),
  });

  const serialized = serializeNotification(notification);
  broadcastNotificationCreated(serialized);
  return serialized;
}

export async function listNotifications(input: ListNotificationsInput): Promise<{
  notifications: SerializedNotification[];
  nextCursor: string | null;
}> {
  const organizationId = organizationObjectId(input.organizationId);
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const query: Record<string, unknown> = {
    organizationId,
    recipientUserId: input.userId,
  };

  if (input.cursor) {
    const cursorDate = new Date(input.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  const docs = await Notification.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const page = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const last = page.at(-1);

  return {
    notifications: page.map(serializeNotification),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}

export async function getUnreadNotificationCount(
  organizationId: Types.ObjectId | string,
  userId: string
): Promise<number> {
  return Notification.countDocuments({
    organizationId: organizationObjectId(organizationId),
    recipientUserId: userId,
    readAt: null,
  });
}

export async function markNotificationRead(input: {
  organizationId: Types.ObjectId | string;
  userId: string;
  notificationId: string;
  read: boolean;
}): Promise<SerializedNotification | null> {
  if (!mongoose.Types.ObjectId.isValid(input.notificationId)) return null;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: input.notificationId,
      organizationId: organizationObjectId(input.organizationId),
      recipientUserId: input.userId,
    },
    { $set: { readAt: input.read ? new Date() : null } },
    { new: true }
  );
  if (!notification) return null;

  const serialized = serializeNotification(notification);
  broadcastNotificationUpdated(serialized);
  return serialized;
}

export async function markAllNotificationsRead(input: {
  organizationId: Types.ObjectId | string;
  userId: string;
}): Promise<{ modifiedCount: number; readAt: string }> {
  const organizationId = organizationObjectId(input.organizationId);
  const readAt = new Date();
  const result = await Notification.updateMany(
    {
      organizationId,
      recipientUserId: input.userId,
      readAt: null,
    },
    { $set: { readAt } }
  );

  broadcastNotificationReadAll({
    organizationId: String(organizationId),
    recipientUserId: input.userId,
    readAt: readAt.toISOString(),
  });

  return {
    modifiedCount: result.modifiedCount,
    readAt: readAt.toISOString(),
  };
}
