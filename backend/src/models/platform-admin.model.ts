import mongoose, { Schema, type Document } from "mongoose";

export interface IPlatformAdmin extends Document {
  userId: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformAdminSchema = new Schema<IPlatformAdmin>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
  },
  { timestamps: true }
);

export const PlatformAdmin = mongoose.model<IPlatformAdmin>(
  "PlatformAdmin",
  platformAdminSchema
);
