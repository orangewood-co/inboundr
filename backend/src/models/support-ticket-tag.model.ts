import mongoose, { Schema, type Document } from "mongoose";

export const SUPPORT_TICKET_TAG_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

export type SupportTicketTagColor = (typeof SUPPORT_TICKET_TAG_COLORS)[number];

export const DEFAULT_SUPPORT_TICKET_TAG_COLOR: SupportTicketTagColor = "slate";

export interface ISupportTicketTag extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  color: SupportTicketTagColor;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketTagSchema = new Schema<ISupportTicketTag>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    color: {
      type: String,
      enum: [...SUPPORT_TICKET_TAG_COLORS],
      default: DEFAULT_SUPPORT_TICKET_TAG_COLOR,
    },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

supportTicketTagSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const SupportTicketTag = mongoose.model<ISupportTicketTag>(
  "SupportTicketTag",
  supportTicketTagSchema
);
