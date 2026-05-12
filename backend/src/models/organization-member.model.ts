import mongoose, { Schema, type Document, type Types } from "mongoose";

export type OrganizationRole = "owner" | "admin" | "member";

export interface IOrganizationMember extends Document {
  organizationId: Types.ObjectId;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}

const organizationMemberSchema = new Schema<IOrganizationMember>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
  },
  { timestamps: true }
);

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
organizationMemberSchema.index({ userId: 1, organizationId: 1 });

export const OrganizationMember = mongoose.model<IOrganizationMember>(
  "OrganizationMember",
  organizationMemberSchema
);
