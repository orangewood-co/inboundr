import mongoose, { Schema, type Document } from "mongoose";

export type OrganizationTheme = "dark" | "light";
export type OrganizationStatus = "active" | "suspended";

export interface IOrganizationDefaultContact {
  name: string;
  email: string;
  phoneNumber: string;
}

export interface IOrganizationPaymentReminders {
  enabled: boolean;
  /** Days after the invoice due date when a reminder is sent (0 = on the due date). */
  offsets: number[];
  sendTimeLocal: string;
  timezone: string;
  sendHourUtc: number;
}

export interface IOrganizationPreferences {
  primaryColor: string;
  theme: OrganizationTheme;
  colorTheme: string;
  pricing: string;
  defaultTerms: string;
  defaultUpiId: string;
  paymentTerms: IOrganizationPaymentTerm[];
  paymentReminders: IOrganizationPaymentReminders;
}

export interface IOrganizationPaymentTerm {
  id: string;
  name: string;
  text: string;
  isDefault: boolean;
}

export interface IOrganizationLetterhead {
  id: string;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: Date;
}

export interface IOrganization extends Document {
  name: string;
  ownerUserId: string;
  status: OrganizationStatus;
  isPro: boolean;
  planSlug: string;
  enabledFeatures: string[];
  disabledFeatures: string[];
  defaultContact: IOrganizationDefaultContact;
  website: string;
  logoUrl: string;
  address: string;
  preferences: IOrganizationPreferences;
  letterheads: IOrganizationLetterhead[];
  activeLetterheadId: string;
  createdAt: Date;
  updatedAt: Date;
}

const defaultContactSchema = new Schema<IOrganizationDefaultContact>(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    phoneNumber: { type: String, default: "" },
  },
  { _id: false }
);

const organizationPaymentRemindersSchema = new Schema<IOrganizationPaymentReminders>(
  {
    enabled: { type: Boolean, default: false },
    offsets: { type: [Number], default: [0, 7, 14] },
    sendTimeLocal: { type: String, default: "10:00" },
    timezone: { type: String, default: "UTC" },
    sendHourUtc: { type: Number, default: 10, min: 0, max: 23 },
  },
  { _id: false }
);

const organizationPreferencesSchema = new Schema<IOrganizationPreferences>(
  {
    primaryColor: { type: String, default: "#f5b400" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    colorTheme: { type: String, default: "default", trim: true },
    pricing: { type: String, default: "INR" },
    defaultTerms: { type: String, default: "" },
    defaultUpiId: { type: String, default: "", trim: true },
    paymentTerms: {
      type: [
        {
          id: { type: String, required: true, trim: true },
          name: { type: String, required: true, trim: true },
          text: { type: String, required: true, trim: true },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    paymentReminders: { type: organizationPaymentRemindersSchema, default: () => ({}) },
  },
  { _id: false }
);

const organizationLetterheadSchema = new Schema<IOrganizationLetterhead>(
  {
    id: { type: String, required: true },
    key: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    isPro: { type: Boolean, default: false },
    planSlug: { type: String, default: "all_features", trim: true, index: true },
    enabledFeatures: { type: [String], default: [] },
    disabledFeatures: { type: [String], default: [] },
    defaultContact: { type: defaultContactSchema, default: () => ({}) },
    website: { type: String, default: "", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    preferences: { type: organizationPreferencesSchema, default: () => ({}) },
    letterheads: { type: [organizationLetterheadSchema], default: [] },
    activeLetterheadId: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema
);
