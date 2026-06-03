import mongoose, { Schema, type Document } from "mongoose";

export type ChatThreadStatus = "regular" | "archived";

export interface IChatThread extends Document {
  userId: string;
  title: string | null;
  status: ChatThreadStatus;
  createdAt: Date;
  updatedAt: Date;
}

const chatThreadSchema = new Schema<IChatThread>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["regular", "archived"],
      default: "regular",
      index: true,
    },
  },
  { timestamps: true }
);

chatThreadSchema.index({ userId: 1, updatedAt: -1 });
chatThreadSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export const ChatThread = mongoose.model<IChatThread>("ChatThread", chatThreadSchema);
