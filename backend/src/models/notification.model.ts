import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface INotification extends Document {
  organizationId: Types.ObjectId;
  recipientUserId: string;
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  readAt?: Date | null;
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    recipientUserId: { type: String, required: true, index: true },
    type: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, default: null, trim: true, maxlength: 1000 },
    actionUrl: { type: String, default: null, trim: true, maxlength: 2048 },
    actorUserId: { type: String, default: null, index: true },
    entityType: { type: String, default: null, trim: true, maxlength: 120 },
    entityId: { type: String, default: null, trim: true, maxlength: 200 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    readAt: { type: Date, default: null, index: true },
    dedupeKey: { type: String, trim: true, maxlength: 240 },
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, recipientUserId: 1, createdAt: -1 });
notificationSchema.index({ organizationId: 1, recipientUserId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { organizationId: 1, recipientUserId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
