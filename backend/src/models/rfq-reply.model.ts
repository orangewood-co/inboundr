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
  rfqId: Types.ObjectId;
  selectedProducts: IRFQReplyProduct[];
  subject: string;
  body: string;
  to: string;
  generatedAt: Date;
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
  },
  { timestamps: true }
);

export const RFQReply = mongoose.model<IRFQReply>("RFQReply", rfqReplySchema);
