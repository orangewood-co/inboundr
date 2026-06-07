import mongoose, { Schema, type Document } from "mongoose";

export type GmailAccountStatus = "connected" | "expired" | "revoked" | "error";

export interface IGmailAccount extends Document {
  userId: string;
  organizationId: mongoose.Types.ObjectId;
  emailAddress: string;
  accessToken: string | null;
  refreshToken: string | null;
  scope: string[];
  tokenExpiry: Date | null;
  historyId: string | null;
  watchExpiration: Date | null;
  status: GmailAccountStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const gmailAccountSchema = new Schema<IGmailAccount>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    emailAddress: { type: String, required: true, lowercase: true, trim: true },
    accessToken: { type: String, default: null },
    refreshToken: { type: String, default: null },
    scope: { type: [String], default: [] },
    tokenExpiry: { type: Date, default: null },
    historyId: { type: String, default: null },
    watchExpiration: { type: Date, default: null },
    status: {
      type: String,
      enum: ["connected", "expired", "revoked", "error"],
      default: "connected",
      index: true,
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

gmailAccountSchema.index({ userId: 1, emailAddress: 1 }, { unique: true });
gmailAccountSchema.index({ organizationId: 1, emailAddress: 1 });
gmailAccountSchema.index({ emailAddress: 1, status: 1 });

export const GmailAccount = mongoose.model<IGmailAccount>(
  "GmailAccount",
  gmailAccountSchema
);
