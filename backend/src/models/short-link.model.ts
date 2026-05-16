import mongoose, { Schema, type Document } from "mongoose";

export type ShortLinkStatus = "active" | "disabled" | "archived";
export type ShortLinkTrackingMode = "standard" | "precise_location";

export interface IShortLink extends Document {
  organizationId: mongoose.Types.ObjectId;
  createdByUserId: string;
  code: string;
  destinationUrl: string;
  title: string | null;
  status: ShortLinkStatus;
  trackingMode: ShortLinkTrackingMode;
  expiresAt: Date | null;
  maxViews: number | null;
  viewCount: number;
  passwordHash: string | null;
  passwordSalt: string | null;
  lastViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shortLinkSchema = new Schema<IShortLink>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdByUserId: { type: String, required: true, index: true },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]{3,72}$/,
    },
    destinationUrl: { type: String, required: true, trim: true },
    title: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["active", "disabled", "archived"],
      default: "active",
      index: true,
    },
    trackingMode: {
      type: String,
      enum: ["standard", "precise_location"],
      default: "standard",
      index: true,
    },
    expiresAt: { type: Date, default: null, index: true },
    maxViews: { type: Number, default: null, min: 1 },
    viewCount: { type: Number, default: 0, min: 0 },
    passwordHash: { type: String, default: null },
    passwordSalt: { type: String, default: null },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shortLinkSchema.index({ code: 1 }, { unique: true });
shortLinkSchema.index({ organizationId: 1, updatedAt: -1 });
shortLinkSchema.index({ status: 1, expiresAt: 1 });

export const ShortLink = mongoose.model<IShortLink>("ShortLink", shortLinkSchema);
