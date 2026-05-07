import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRFQCustomer {
  name: string;
  company: string;
  email: string;
  contactNumber: string | null;
  address: string | null;
}

export interface IRFQProduct {
  name: string;
  quantity: number;
}

export interface IRFQSearchMatch {
  id: number;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  link: string | null;
  score: number;
  matchReasons: string[];
}

export interface IRFQSearchResult {
  query: { name: string; quantity: number };
  normalizedQuery: string;
  searchTokens: string[];
  matchedBrand: string | null;
  status: "matched" | "ambiguous" | "no_match";
  matches: IRFQSearchMatch[];
}

export interface IRFQ extends Document {
  userId: string;
  gmailAccountId: Types.ObjectId;
  emailId: Types.ObjectId;
  isRFQ: boolean;
  reason: string;
  isProcessed: boolean;
  customer: IRFQCustomer | null;
  queryProducts: IRFQProduct[];
  searchResults: IRFQSearchResult[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const rfqSearchMatchSchema = new Schema<IRFQSearchMatch>(
  {
    id: { type: Number, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
    link: { type: String, default: null },
    score: { type: Number, required: true },
    matchReasons: { type: [String], default: [] },
  },
  { _id: false }
);

const rfqSearchResultSchema = new Schema<IRFQSearchResult>(
  {
    query: {
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
    },
    normalizedQuery: { type: String, required: true },
    searchTokens: { type: [String], default: [] },
    matchedBrand: { type: String, default: null },
    status: {
      type: String,
      enum: ["matched", "ambiguous", "no_match"],
      required: true,
    },
    matches: { type: [rfqSearchMatchSchema], default: [] },
  },
  { _id: false }
);

const rfqSchema = new Schema<IRFQ>(
  {
    userId: { type: String, required: true, index: true },
    gmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "GmailAccount",
      required: true,
      index: true,
    },
    emailId: {
      type: Schema.Types.ObjectId,
      ref: "Email",
      required: true,
      unique: true,
    },
    isRFQ: { type: Boolean, required: true },
    reason: { type: String, required: true },
    isProcessed: { type: Boolean, default: false },
    customer: {
      type: {
        name: { type: String, required: true },
        company: { type: String, required: true },
        email: { type: String, required: true },
        contactNumber: { type: String, default: null },
        address: { type: String, default: null },
      },
      default: null,
    },
    queryProducts: {
      type: [
        {
          name: { type: String, required: true },
          quantity: { type: Number, required: true },
        },
      ],
      default: [],
    },
    searchResults: { type: [rfqSearchResultSchema], default: [] },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

rfqSchema.index({ userId: 1, isRFQ: 1, createdAt: -1 });

export const RFQ = mongoose.model<IRFQ>("RFQ", rfqSchema);
