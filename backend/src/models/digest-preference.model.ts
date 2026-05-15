import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDigestSections {
  emailVolume: boolean;
  rfqBreakdown: boolean;
  productRequests: boolean;
  matchQuality: boolean;
}

export interface IDigestPreference extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  enabled: boolean;
  sections: IDigestSections;
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
