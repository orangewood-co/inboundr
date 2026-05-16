import mongoose, { Schema, type Document } from "mongoose";

export type ShortLinkEventResult =
  | "redirected"
  | "password_required"
  | "password_failed"
  | "precise_location_required"
  | "expired"
  | "view_limit_reached"
  | "disabled"
  | "not_found";

export interface IShortLinkEvent extends Document {
  linkId: mongoose.Types.ObjectId | null;
  organizationId: mongoose.Types.ObjectId | null;
  code: string;
  openedAt: Date;
  result: ShortLinkEventResult;
  referrer: string | null;
  ipHash: string | null;
  userAgent: {
    raw: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
  };
  approximateLocation: {
    country: string | null;
    region: string | null;
    city: string | null;
  };
  preciseLocation: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const shortLinkEventSchema = new Schema<IShortLinkEvent>(
  {
    linkId: { type: Schema.Types.ObjectId, ref: "ShortLink", default: null, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    code: { type: String, required: true, trim: true, lowercase: true, index: true },
    openedAt: { type: Date, default: Date.now, index: true },
    result: {
      type: String,
      required: true,
      enum: [
        "redirected",
        "password_required",
        "password_failed",
        "precise_location_required",
        "expired",
        "view_limit_reached",
        "disabled",
        "not_found",
      ],
      index: true,
    },
    referrer: { type: String, default: null },
    ipHash: { type: String, default: null },
    userAgent: {
      raw: { type: String, default: null },
      browser: { type: String, default: null },
      os: { type: String, default: null },
      device: { type: String, default: null },
    },
    approximateLocation: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
    },
    preciseLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

shortLinkEventSchema.index({ linkId: 1, openedAt: -1 });
shortLinkEventSchema.index({ organizationId: 1, openedAt: -1 });

export const ShortLinkEvent = mongoose.model<IShortLinkEvent>("ShortLinkEvent", shortLinkEventSchema);
