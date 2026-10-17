import mongoose, { Schema, type Document } from "mongoose";

export type WhatsAppAccountStatus = "connected" | "error" | "disabled";

/**
 * `primary` serves support tickets, invoices and payment reminders. `rfq` is a
 * dedicated sales number whose chats land in the Inbox and become RFQs; it
 * never opens support tickets.
 */
export type WhatsAppAccountPurpose = "primary" | "rfq";

export const WHATSAPP_ACCOUNT_PURPOSES: WhatsAppAccountPurpose[] = ["primary", "rfq"];

/** Meta template review states, plus our own marker for "not created yet". */
export type WhatsAppTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "MISSING";

/** Snapshot of one Inboundr-managed message template on the org's WABA. */
export interface IWhatsAppAccountTemplate {
  name: string;
  language: string;
  category: string;
  status: WhatsAppTemplateStatus;
  metaId: string | null;
  rejectedReason: string | null;
  updatedAt: Date;
}

/**
 * A WhatsApp Business phone number connected to an organization via the Meta
 * Cloud API. An organization has at most one number per purpose. Inbound
 * webhooks are routed by `phoneNumberId`; outbound sends use the stored
 * (encrypted) access token.
 */
export interface IWhatsAppAccount extends Document {
  organizationId: mongoose.Types.ObjectId;
  purpose: WhatsAppAccountPurpose;
  /**
   * RFQ numbers only: the user whose Inbox and RFQ list new chats land in, the
   * same way a Gmail account belongs to the person who connected it.
   */
  ownerUserId: string | null;
  /** Meta phone number id (`metadata.phone_number_id` on webhooks). */
  phoneNumberId: string;
  /** WhatsApp Business Account id; required for template management. */
  wabaId: string | null;
  /**
   * Meta app id the token belongs to. Needed for the Resumable Upload API when
   * creating templates with media headers. Null means "use the platform app".
   */
  appId: string | null;
  /** Inboundr-managed templates and their Meta review status. */
  templates: IWhatsAppAccountTemplate[];
  templatesSyncedAt: Date | null;
  /** Human-readable number, e.g. +91 80467 33659, as reported by Meta. */
  displayPhoneNumber: string;
  /** Verified business display name reported by Meta. */
  verifiedName: string;
  /** Encrypted permanent (system user) access token. */
  accessToken: string;
  /**
   * Encrypted app secret for signature verification when the organization
   * connected its own Meta app. Null means "use the platform app secret".
   */
  appSecret: string | null;
  /** Token the org pastes into Meta's webhook config; matched on GET verification. */
  verifyToken: string;
  /** Whether inbound messages should be accepted and turned into tickets. */
  enabled: boolean;
  status: WhatsAppAccountStatus;
  errorMessage: string | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppAccountTemplateSchema = new Schema<IWhatsAppAccountTemplate>(
  {
    name: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true },
    category: { type: String, default: "UTILITY", trim: true },
    status: {
      type: String,
      enum: ["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED", "IN_APPEAL", "MISSING"],
      default: "MISSING",
    },
    metaId: { type: String, default: null, trim: true },
    rejectedReason: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const whatsAppAccountSchema = new Schema<IWhatsAppAccount>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    purpose: {
      type: String,
      enum: WHATSAPP_ACCOUNT_PURPOSES,
      default: "primary",
    },
    ownerUserId: { type: String, default: null },
    phoneNumberId: { type: String, required: true, trim: true, unique: true },
    wabaId: { type: String, default: null, trim: true, index: true },
    appId: { type: String, default: null, trim: true },
    templates: { type: [whatsAppAccountTemplateSchema], default: [] },
    templatesSyncedAt: { type: Date, default: null },
    displayPhoneNumber: { type: String, default: "", trim: true },
    verifiedName: { type: String, default: "", trim: true },
    accessToken: { type: String, required: true },
    appSecret: { type: String, default: null },
    verifyToken: { type: String, required: true, trim: true, index: true },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["connected", "error", "disabled"],
      default: "connected",
      index: true,
    },
    errorMessage: { type: String, default: null },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

whatsAppAccountSchema.index({ organizationId: 1, purpose: 1 }, { unique: true });

export const WhatsAppAccount = mongoose.model<IWhatsAppAccount>(
  "WhatsAppAccount",
  whatsAppAccountSchema
);
