import mongoose, { Schema, type Document, type Types } from "mongoose";
import { rfqAdjustmentSchema, type IRFQAdjustment, type IRFQTax } from "./rfq.model";

export interface IRFQReplyProduct {
  queryName: string;
  quantity: number;
  productId: string;
  brand: string | null;
  description: string | null;
  code: string | null;
  basePrice: number | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  discountPercent: number;
  tax: IRFQTax;
  attributes: Record<string, string | number | boolean | null>;
  adjustments: IRFQAdjustment[];
}

export interface IRFQReply extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  gmailAccountId: Types.ObjectId;
  rfqId: Types.ObjectId;
  selectedProducts: IRFQReplyProduct[];
  specialDiscountPercentage: number;
  paymentTermTemplateId: string | null;
  paymentTermName: string | null;
  paymentTerms: string;
  deliveryTermTemplateId: string | null;
  deliveryTermName: string | null;
  deliveryTerms: string;
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
    productId: { type: String, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    basePrice: { type: Number, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
    discountPercent: { type: Number, default: 0 },
    tax: {
      code: { type: String, default: null },
      rate: { type: Number, default: null },
      label: { type: String, default: "Tax" },
    },
    attributes: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    adjustments: {
      type: [rfqAdjustmentSchema],
      default: [],
    },
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
    specialDiscountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    paymentTermTemplateId: { type: String, default: null, trim: true },
    paymentTermName: { type: String, default: null, trim: true },
    paymentTerms: { type: String, default: "", trim: true },
    deliveryTermTemplateId: { type: String, default: null, trim: true },
    deliveryTermName: { type: String, default: null, trim: true },
    deliveryTerms: { type: String, default: "", trim: true },
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
