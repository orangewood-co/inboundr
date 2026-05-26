import mongoose, { Schema, type Document } from "mongoose";

export type OrganizationTheme = "dark" | "light";
export type OrganizationStatus = "active" | "suspended";

export interface IOrganizationDefaultContact {
  name: string;
  email: string;
  phoneNumber: string;
}

export interface IOrganizationPreferences {
  primaryColor: string;
  theme: OrganizationTheme;
  colorTheme: string;
  pricing: string;
  defaultTerms: string;
}

export interface IOrganization extends Document {
  name: string;
  ownerUserId: string;
  status: OrganizationStatus;
  planSlug: string;
  enabledFeatures: string[];
  disabledFeatures: string[];
  defaultContact: IOrganizationDefaultContact;
  website: string;
  logoUrl: string;
  address: string;
  preferences: IOrganizationPreferences;
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

const organizationPreferencesSchema = new Schema<IOrganizationPreferences>(
  {
    primaryColor: { type: String, default: "#f5b400" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    colorTheme: { type: String, default: "default", trim: true },
    pricing: { type: String, default: "INR" },
    defaultTerms: { type: String, default: "" },
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
    planSlug: { type: String, default: "all_features", trim: true, index: true },
    enabledFeatures: { type: [String], default: [] },
    disabledFeatures: { type: [String], default: [] },
    defaultContact: { type: defaultContactSchema, default: () => ({}) },
    website: { type: String, default: "", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    preferences: { type: organizationPreferencesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>(
  "Organization",
  organizationSchema
);
