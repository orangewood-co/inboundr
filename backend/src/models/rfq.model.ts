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
  calibrationCharges: number | null;
  link: string | null;
  isTopSeller: boolean;
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

export interface IRFQSavedQuoteProduct {
  searchResultIndex: number | null;
  queryName: string;
  quantity: number;
  productId: number;
  brand: string | null;
  description: string | null;
  code: string | null;
  basePrice: number | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  discountPercent?: number;
  calibrationCharges: number | null;
  deliveryTimeline: string | null;
  lineStatus: "quoted" | "regretted";
  regretReason: string | null;
}

export interface IRFQ extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  gmailAccountId: Types.ObjectId;
  emailId: Types.ObjectId;
  isRFQ: boolean;
  reason: string;
  isProcessed: boolean;
  customer: IRFQCustomer | null;
  queryProducts: IRFQProduct[];
  searchResults: IRFQSearchResult[];
  errorMessage: string | null;
  isArchived: boolean;
  workflowStatus: "new" | "draft" | "processed";
  savedQuoteProducts: IRFQSavedQuoteProduct[];
  paymentTermTemplateId: string | null;
  paymentTermName: string | null;
  paymentTerms: string | null;
  deliveryTermTemplateId: string | null;
  deliveryTermName: string | null;
  deliveryTerms: string | null;
  quoteNotes: string | null;
  quoteNumber: string | null;
  draftSavedAt: Date | null;
  processedAt: Date | null;
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
    calibrationCharges: { type: Number, default: null },
    link: { type: String, default: null },
    isTopSeller: { type: Boolean, default: false },
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

const rfqSavedQuoteProductSchema = new Schema<IRFQSavedQuoteProduct>(
  {
    searchResultIndex: { type: Number, default: null },
    queryName: { type: String, required: true },
    quantity: { type: Number, required: true },
    productId: { type: Number, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    basePrice: { type: Number, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
    discountPercent: { type: Number, default: 0 },
    calibrationCharges: { type: Number, default: null },
    deliveryTimeline: { type: String, default: null },
    lineStatus: {
      type: String,
      enum: ["quoted", "regretted"],
      default: "quoted",
    },
    regretReason: { type: String, default: null },
  },
  { _id: false }
);

const rfqSchema = new Schema<IRFQ>(
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
    isArchived: { type: Boolean, default: false },
    workflowStatus: {
      type: String,
      enum: ["new", "draft", "processed"],
      default: "new",
      index: true,
    },
    savedQuoteProducts: { type: [rfqSavedQuoteProductSchema], default: [] },
    paymentTermTemplateId: { type: String, default: null, trim: true },
    paymentTermName: { type: String, default: null, trim: true },
    paymentTerms: { type: String, default: null, trim: true },
    deliveryTermTemplateId: { type: String, default: null, trim: true },
    deliveryTermName: { type: String, default: null, trim: true },
    deliveryTerms: { type: String, default: null, trim: true },
    quoteNotes: { type: String, default: null, trim: true },
    quoteNumber: { type: String, default: null },
    draftSavedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rfqSchema.index({ userId: 1, isRFQ: 1, createdAt: -1 });
rfqSchema.index({ organizationId: 1, isRFQ: 1, createdAt: -1 });
rfqSchema.index({ organizationId: 1, workflowStatus: 1, draftSavedAt: -1 });

export const RFQ = mongoose.model<IRFQ>("RFQ", rfqSchema);
