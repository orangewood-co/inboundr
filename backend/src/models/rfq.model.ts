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
  code: string | null;
  manufacturer: string | null;
  specifications: Record<string, string>;
}

export interface IRFQTax {
  code: string | null;
  rate: number | null;
  label: string;
}

export interface IRFQAdjustment {
  id: string;
  code: string;
  label: string;
  type: "fixed" | "percentage";
  value: number;
  amount?: number;
  taxable: boolean;
}

export interface IRFQSearchMatch {
  id: string;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  calibrationCharges: number | null;
  tax: IRFQTax;
  attributes: Record<string, string | number | boolean | null>;
  defaultAdjustments: IRFQAdjustment[];
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
  productId: string;
  brand: string | null;
  description: string | null;
  code: string | null;
  basePrice: number | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  discountPercent?: number;
  calibrationCharges: number | null;
  tax: IRFQTax;
  attributes: Record<string, string | number | boolean | null>;
  adjustments: IRFQAdjustment[];
  deliveryTimeline: string | null;
  lineStatus: "quoted" | "regretted";
  regretReason: string | null;
}

export interface IRFQManualAttachment {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface IRFQManualInput {
  text: string | null;
  attachments: IRFQManualAttachment[];
}

export type RFQSource = "email" | "manual" | "whatsapp";

export interface IRFQ extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  source: RFQSource;
  gmailAccountId: Types.ObjectId | null;
  emailId: Types.ObjectId | null;
  manualInput: IRFQManualInput | null;
  inboxConversationId: Types.ObjectId | null;
  conversationStartedAt: Date | null;
  threadId: string | null;
  latestEmailId: Types.ObjectId | null;
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

export const rfqAdjustmentSchema = new Schema<IRFQAdjustment>(
  {
    id: { type: String, required: true },
    code: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    value: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    taxable: { type: Boolean, default: false },
  },
  { _id: false }
);

const rfqSearchMatchSchema = new Schema<IRFQSearchMatch>(
  {
    id: { type: String, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
    calibrationCharges: { type: Number, default: null },
    tax: {
      code: { type: String, default: null },
      rate: { type: Number, default: null },
      label: { type: String, default: "Tax" },
    },
    attributes: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    defaultAdjustments: {
      type: [rfqAdjustmentSchema],
      default: [],
    },
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
    productId: { type: String, required: true },
    brand: { type: String, default: null },
    description: { type: String, default: null },
    code: { type: String, default: null },
    basePrice: { type: Number, default: null },
    price: { type: Number, default: null },
    hsnCode: { type: String, default: null },
    gstRate: { type: Number, default: null },
    discountPercent: { type: Number, default: 0 },
    calibrationCharges: { type: Number, default: null },
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
    // "email" RFQs come from a linked Gmail account; "manual" RFQs are created
    // from pasted text or uploaded files and have no source email or account;
    // "whatsapp" RFQs come from a chat on the organization's RFQ number.
    source: {
      type: String,
      enum: ["email", "manual", "whatsapp"],
      default: "email",
    },
    gmailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "GmailAccount",
      required: false,
      default: null,
      index: true,
    },
    emailId: {
      type: Schema.Types.ObjectId,
      ref: "Email",
      required: false,
      default: null,
    },
    // Original submission of a manual RFQ, kept so processing can be re-run
    // and the source can be shown in the UI.
    manualInput: {
      type: {
        text: { type: String, default: null },
        attachments: {
          type: [
            {
              key: { type: String, required: true },
              filename: { type: String, required: true },
              mimeType: { type: String, required: true },
              size: { type: Number, required: true },
            },
          ],
          default: [],
          _id: false,
        },
      },
      default: null,
    },
    inboxConversationId: {
      type: Schema.Types.ObjectId,
      ref: "InboxConversation",
      default: null,
      index: true,
    },
    // A WhatsApp chat holds many requests over time; this RFQ covers the
    // messages from this point on, so re-extraction reads only those.
    conversationStartedAt: { type: Date, default: null },
    // Gmail conversation id of the source email, so replies on the same
    // thread can find and update this RFQ instead of spawning a new one.
    threadId: { type: String, default: null },
    // Most recent thread message that refreshed the extracted data.
    latestEmailId: {
      type: Schema.Types.ObjectId,
      ref: "Email",
      default: null,
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
          code: { type: String, default: null },
          manufacturer: { type: String, default: null },
          specifications: { type: Map, of: String, default: () => new Map() },
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

// Partial instead of a plain unique index: manual RFQs carry no emailId, and a
// non-partial unique index would treat every missing emailId as the same value.
rfqSchema.index(
  { emailId: 1 },
  { unique: true, partialFilterExpression: { emailId: { $type: "objectId" } } }
);
rfqSchema.index({ gmailAccountId: 1, threadId: 1 });
rfqSchema.index({ userId: 1, isRFQ: 1, createdAt: -1 });
rfqSchema.index({ organizationId: 1, isRFQ: 1, createdAt: -1 });
rfqSchema.index({ organizationId: 1, workflowStatus: 1, draftSavedAt: -1 });
// RFQ list supports sorting by updatedAt as well as createdAt.
rfqSchema.index({ userId: 1, isRFQ: 1, updatedAt: -1 });

export const RFQ = mongoose.model<IRFQ>("RFQ", rfqSchema);
