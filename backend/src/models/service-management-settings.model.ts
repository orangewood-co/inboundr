import mongoose, { Schema, type Document, type Types } from "mongoose";
import { SERVICE_SYSTEM_CATEGORIES, type ServiceSystemCategory } from "./service-request.model";

export interface IServiceStatusDefinition {
  id: string;
  label: string;
  systemCategory: ServiceSystemCategory;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  order: number;
}

export interface IServiceManagementSettings extends Document {
  organizationId: Types.ObjectId;
  fiscalYearStartMonth: number;
  numberPadding: number;
  prefixes: { serviceRequest: string; serviceVisit: string; spareDispatch: string; rootCauseAnalysis: string };
  statuses: IServiceStatusDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_SERVICE_STATUSES: IServiceStatusDefinition[] = [
  { id: "new", label: "New", systemCategory: "open", color: "#3b82f6", isDefault: true, isActive: true, order: 10 },
  { id: "assigned", label: "Assigned", systemCategory: "open", color: "#2563eb", isDefault: false, isActive: true, order: 20 },
  { id: "remote_support", label: "Remote Support", systemCategory: "open", color: "#06b6d4", isDefault: false, isActive: true, order: 30 },
  { id: "visit_scheduled", label: "Visit Scheduled", systemCategory: "open", color: "#8b5cf6", isDefault: false, isActive: true, order: 40 },
  { id: "engineer_travelling", label: "Engineer Travelling", systemCategory: "open", color: "#a855f7", isDefault: false, isActive: true, order: 50 },
  { id: "on_site", label: "On Site", systemCategory: "open", color: "#6366f1", isDefault: false, isActive: true, order: 60 },
  { id: "waiting_for_customer", label: "Waiting for Customer", systemCategory: "waiting", color: "#f59e0b", isDefault: false, isActive: true, order: 70 },
  { id: "waiting_for_spare", label: "Waiting for Spare", systemCategory: "waiting", color: "#f97316", isDefault: false, isActive: true, order: 80 },
  { id: "waiting_for_oem", label: "Waiting for OEM", systemCategory: "waiting", color: "#ea580c", isDefault: false, isActive: true, order: 90 },
  { id: "under_observation", label: "Under Observation", systemCategory: "waiting", color: "#d97706", isDefault: false, isActive: true, order: 100 },
  { id: "testing", label: "Testing", systemCategory: "open", color: "#0ea5e9", isDefault: false, isActive: true, order: 110 },
  { id: "customer_confirmation_pending", label: "Customer Confirmation Pending", systemCategory: "waiting", color: "#eab308", isDefault: false, isActive: true, order: 120 },
  { id: "resolved", label: "Resolved", systemCategory: "resolved", color: "#10b981", isDefault: false, isActive: true, order: 130 },
  { id: "closed", label: "Closed", systemCategory: "closed", color: "#64748b", isDefault: false, isActive: true, order: 140 },
  { id: "cancelled", label: "Cancelled", systemCategory: "cancelled", color: "#ef4444", isDefault: false, isActive: true, order: 150 },
];

const statusSchema = new Schema<IServiceStatusDefinition>(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    systemCategory: { type: String, enum: SERVICE_SYSTEM_CATEGORIES, required: true },
    color: { type: String, default: "#64748b", trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const serviceManagementSettingsSchema = new Schema<IServiceManagementSettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    fiscalYearStartMonth: { type: Number, min: 1, max: 12, default: 4 },
    numberPadding: { type: Number, min: 1, max: 10, default: 4 },
    prefixes: {
      type: new Schema(
        {
          serviceRequest: { type: String, default: "SR", trim: true, uppercase: true },
          serviceVisit: { type: String, default: "SV", trim: true, uppercase: true },
          spareDispatch: { type: String, default: "SP", trim: true, uppercase: true },
          rootCauseAnalysis: { type: String, default: "RCA", trim: true, uppercase: true },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    statuses: { type: [statusSchema], default: () => DEFAULT_SERVICE_STATUSES.map((status) => ({ ...status })) },
  },
  { timestamps: true }
);

export const ServiceManagementSettings = mongoose.model<IServiceManagementSettings>(
  "ServiceManagementSettings",
  serviceManagementSettingsSchema
);
