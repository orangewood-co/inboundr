import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IChatMessage extends Document {
  threadId: Types.ObjectId;
  userId: string;
  messageId: string;
  parentId: string | null;
  format: string;
  content: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ChatThread",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    parentId: { type: String, default: null },
    format: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

chatMessageSchema.index({ threadId: 1, createdAt: 1 });
chatMessageSchema.index({ threadId: 1, messageId: 1 }, { unique: true });
chatMessageSchema.index({ userId: 1, threadId: 1 });

export const ChatMessage = mongoose.model<IChatMessage>("ChatMessage", chatMessageSchema);
