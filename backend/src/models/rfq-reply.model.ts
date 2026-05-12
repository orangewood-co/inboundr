import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRFQReplyProduct {
  queryName: string;
  quantity: number;
  productId: number;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
}

export interface IRFQReply extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  gmailAccountId: Types.ObjectId;
  rfqId: Types.ObjectId;
  selectedProducts: IRFQReplyProduct[];
  subject: string;
  body: string;
  to: string;
  generatedAt: Date;
  sendStatus: "draft" | "sending" | "sent" | "failed";
  sentAt: Date | null;
  gmailMessageId: string | null;
  sendErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const rfqReplyProductSchema = new Schema<IRFQReplyProduct>(
  {
    queryName: { type: String, required: true },
    quantity: { type: Number, required: true },
    productId: { type: Number, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
  },
  { _id: false }
);

const rfqReplySchema = new Schema<IRFQReply>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    gmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "GmailAccount",
      required: true,
      index: true,
    },
    rfqId: {
      type: Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
      unique: true,
    },
    selectedProducts: { type: [rfqReplyProductSchema], default: [] },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    to: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    sendStatus: {
      type: String,
      enum: ["draft", "sending", "sent", "failed"],
      default: "draft",
      index: true,
    },
    sentAt: { type: Date, default: null },
    gmailMessageId: { type: String, default: null },
    sendErrorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

rfqReplySchema.index({ organizationId: 1, sendStatus: 1, createdAt: -1 });

export const RFQReply = mongoose.model<IRFQReply>("RFQReply", rfqReplySchema);
