import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { OrganizationRole } from "./organization-member.model";

export type OrganizationInvitationStatus = "pending" | "accepted" | "cancelled";

export interface IOrganizationInvitation extends Document {
  organizationId: Types.ObjectId;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  invitedByUserId: string;
  status: OrganizationInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const organizationInvitationSchema = new Schema<IOrganizationInvitation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    invitedByUserId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "cancelled"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

organizationInvitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

export const OrganizationInvitation = mongoose.model<IOrganizationInvitation>(
  "OrganizationInvitation",
  organizationInvitationSchema
);
