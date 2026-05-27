import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDigestSections {
  emailVolume: boolean;
  rfqBreakdown: boolean;
  productRequests: boolean;
  matchQuality: boolean;
}

export type DigestRecipientMode = "all_members" | "custom";

export interface IDigestPreference extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  enabled: boolean;
  sections: IDigestSections;
  recipientMode: DigestRecipientMode;
  memberRecipientUserIds: string[];
  externalRecipientEmails: string[];
  sendTimeLocal: string;
  timezone: string;
  sendHourUtc: number;
  createdAt: Date;
  updatedAt: Date;
}

const digestSectionsSchema = new Schema<IDigestSections>(
  {
    emailVolume: { type: Boolean, default: true },
    rfqBreakdown: { type: Boolean, default: true },
    productRequests: { type: Boolean, default: true },
    matchQuality: { type: Boolean, default: true },
  },
  { _id: false }
);

const digestPreferenceSchema = new Schema<IDigestPreference>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: false },
    sections: { type: digestSectionsSchema, default: () => ({}) },
    recipientMode: {
      type: String,
      enum: ["all_members", "custom"],
      default: "all_members",
    },
    memberRecipientUserIds: { type: [String], default: [] },
    externalRecipientEmails: { type: [String], default: [] },
    sendTimeLocal: {
      type: String,
      default: "08:00",
      validate: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    timezone: { type: String, default: "UTC" },
    sendHourUtc: { type: Number, default: 8, min: 0, max: 23 },
  },
  { timestamps: true }
);

digestPreferenceSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
digestPreferenceSchema.index({ enabled: 1, sendHourUtc: 1 });

export const DigestPreference = mongoose.model<IDigestPreference>(
  "DigestPreference",
  digestPreferenceSchema
);
