import mongoose, { Schema, type Document } from "mongoose";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "written_off";

export type InvoicePaymentMethod =
  | "cash"
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "card"
  | "other";

export type InvoiceRecurringFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface IInvoiceLineItem {
  productId: number | null;
  description: string;
  productCode: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  gstRate: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface IInvoicePayment {
  amount: number;
  date: Date;
  method: InvoicePaymentMethod;
  reference: string;
  notes: string;
}

export interface IInvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  balanceDue: number;
}

export interface IInvoiceReminder {
  /** Days after the due date this reminder corresponds to (0 = on the due date). */
  offsetDays: number;
  sentAt: Date;
  gmailMessageId: string;
}

export interface IInvoiceRecurringProfile {
  enabled: boolean;
  frequency: InvoiceRecurringFrequency | null;
  startDate: Date | null;
  endDate: Date | null;
  nextRunDate: Date | null;
  autoSend: boolean;
}

export interface IInvoice extends Document {
  organizationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId | null;
  invoiceNumber: string;
  template: "professional" | "compact" | "modern";
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  paymentTerms: string;
  poNumber: string;
  notes: string;
  termsAndConditions: string;
  /** Per-invoice UPI ID override; empty means use the organization default at render time. */
  upiId: string;
  customerSnapshot: {
    name: string;
    company: string;
    email: string;
    contactNumber: string;
    billingAddress: string;
    shippingAddress: string;
  };
  organizationSnapshot: {
    name: string;
    email: string;
    phoneNumber: string;
    address: string;
    logoUrl: string;
    website: string;
    primaryColor: string;
  };
  lineItems: IInvoiceLineItem[];
  payments: IInvoicePayment[];
  totals: IInvoiceTotals;
  recurring: IInvoiceRecurringProfile;
  remindersEnabled: boolean;
  reminders: IInvoiceReminder[];
  sentAt: Date | null;
  viewedAt: Date | null;
  cancelledAt: Date | null;
  writtenOffAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    productId: { type: Number, default: null },
    description: { type: String, required: true, trim: true },
    productCode: { type: String, default: "", trim: true },
    hsnCode: { type: String, default: "", trim: true },
    unit: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    gstRate: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoicePaymentSchema = new Schema<IInvoicePayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "upi", "cheque", "card", "other"],
      default: "bank_transfer",
    },
    reference: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const invoiceTotalsSchema = new Schema<IInvoiceTotals>(
  {
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidTotal: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoiceReminderSchema = new Schema<IInvoiceReminder>(
  {
    offsetDays: { type: Number, required: true },
    sentAt: { type: Date, required: true },
    gmailMessageId: { type: String, default: "" },
  },
  { _id: false }
);

const invoiceRecurringSchema = new Schema<IInvoiceRecurringProfile>(
  {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly", null],
      default: null,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    nextRunDate: { type: Date, default: null },
    autoSend: { type: Boolean, default: false },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    invoiceNumber: { type: String, required: true, trim: true },
    template: {
      type: String,
      enum: ["professional", "compact", "modern"],
      default: "professional",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "viewed",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
        "written_off",
      ],
      default: "draft",
      index: true,
    },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, default: null, index: true },
    paymentTerms: { type: String, default: "", trim: true },
    poNumber: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    termsAndConditions: { type: String, default: "", trim: true },
    upiId: { type: String, default: "", trim: true, lowercase: true },
    customerSnapshot: {
      name: { type: String, default: "", trim: true },
      company: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      contactNumber: { type: String, default: "", trim: true },
      billingAddress: { type: String, default: "", trim: true },
      shippingAddress: { type: String, default: "", trim: true },
    },
    organizationSnapshot: {
      name: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      phoneNumber: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      logoUrl: { type: String, default: "", trim: true },
      website: { type: String, default: "", trim: true },
      primaryColor: { type: String, default: "#f5b400", trim: true },
    },
    lineItems: { type: [invoiceLineItemSchema], default: [] },
    payments: { type: [invoicePaymentSchema], default: [] },
    totals: { type: invoiceTotalsSchema, default: () => ({}) },
    recurring: { type: invoiceRecurringSchema, default: () => ({}) },
    remindersEnabled: { type: Boolean, default: true },
    reminders: { type: [invoiceReminderSchema], default: [] },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    writtenOffAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
invoiceSchema.index({
  invoiceNumber: "text",
  "customerSnapshot.name": "text",
  "customerSnapshot.company": "text",
  "customerSnapshot.email": "text",
});

export const Invoice = mongoose.model<IInvoice>("Invoice", invoiceSchema);
