import mongoose, { Schema, type Document, type Types } from "mongoose";
import {
  ASSET_DEPRECIATION_METHODS,
  type AssetDepreciationMethod,
} from "./asset-category.model";

export const ASSET_LIFECYCLE_STATUSES = [
  "draft",
  "active",
  "sold",
  "scrapped",
] as const;

export const ASSET_CONDITIONS = [
  "in_use",
  "in_storage",
  "in_repair",
  "out_of_order",
] as const;

export type AssetLifecycleStatus = (typeof ASSET_LIFECYCLE_STATUSES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type AssetDisposalType = "sold" | "scrapped";
export type AssetScheduleRowSource = "auto" | "adjustment";

export interface IAssetDepreciationParams {
  method: AssetDepreciationMethod;
  usefulLifeMonths: number;
  salvagePercentage: number;
  wdvRatePercentage: number;
  /** Depreciation already booked before the asset entered inboundr (imported registers). */
  openingAccumulatedDepreciation: number;
}

export interface IAssetScheduleRow {
  periodStartDate: Date;
  periodEndDate: Date;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValueAtEnd: number;
  source: AssetScheduleRowSource;
}

export interface IAssetRepair {
  id: string;
  date: Date;
  description: string;
  cost: number;
  loggedBy: string | null;
  createdAt: Date;
}

export interface IAssetValueAdjustment {
  id: string;
  date: Date;
  previousBookValue: number;
  newValue: number;
  reason: string;
  adjustedBy: string | null;
  createdAt: Date;
}

export interface IAssetDisposal {
  type: AssetDisposalType;
  date: Date;
  saleAmount: number;
  buyerName: string;
  notes: string;
  bookValueAtDisposal: number;
  gainLoss: number;
}

export interface IAssetAttachment {
  id: string;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: Date;
}

export interface IAsset extends Document {
  organizationId: Types.ObjectId;
  assetCode: string;
  name: string;
  serialNumber: string;
  description: string;
  categoryId: Types.ObjectId | null;
  purchaseDate: Date | null;
  purchaseCost: number;
  vendorName: string;
  invoiceReference: string;
  /** Depreciation starts from this date; defaults to the purchase date. */
  availableForUseDate: Date | null;
  depreciation: IAssetDepreciationParams;
  depreciationSchedule: IAssetScheduleRow[];
  assignedEmployeeId: Types.ObjectId | null;
  locationId: Types.ObjectId | null;
  lifecycleStatus: AssetLifecycleStatus;
  condition: AssetCondition;
  warrantyExpiryDate: Date | null;
  amcExpiryDate: Date | null;
  repairs: IAssetRepair[];
  valueAdjustments: IAssetValueAdjustment[];
  disposal: IAssetDisposal | null;
  attachments: IAssetAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const depreciationParamsSchema = new Schema<IAssetDepreciationParams>(
  {
    method: {
      type: String,
      enum: ASSET_DEPRECIATION_METHODS,
      default: "straight_line",
    },
    usefulLifeMonths: { type: Number, default: 60, min: 1 },
    salvagePercentage: { type: Number, default: 0, min: 0, max: 95 },
    wdvRatePercentage: { type: Number, default: 0, min: 0, max: 100 },
    openingAccumulatedDepreciation: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const scheduleRowSchema = new Schema<IAssetScheduleRow>(
  {
    periodStartDate: { type: Date, required: true },
    periodEndDate: { type: Date, required: true },
    depreciationAmount: { type: Number, required: true },
    accumulatedDepreciation: { type: Number, required: true },
    bookValueAtEnd: { type: Number, required: true },
    source: { type: String, enum: ["auto", "adjustment"], default: "auto" },
  },
  { _id: false }
);

const repairSchema = new Schema<IAssetRepair>(
  {
    id: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true, trim: true },
    cost: { type: Number, default: 0, min: 0 },
    loggedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const valueAdjustmentSchema = new Schema<IAssetValueAdjustment>(
  {
    id: { type: String, required: true },
    date: { type: Date, required: true },
    previousBookValue: { type: Number, required: true },
    newValue: { type: Number, required: true },
    reason: { type: String, default: "", trim: true },
    adjustedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const disposalSchema = new Schema<IAssetDisposal>(
  {
    type: { type: String, enum: ["sold", "scrapped"], required: true },
    date: { type: Date, required: true },
    saleAmount: { type: Number, default: 0, min: 0 },
    buyerName: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    bookValueAtDisposal: { type: Number, required: true },
    gainLoss: { type: Number, required: true },
  },
  { _id: false }
);

const attachmentSchema = new Schema<IAssetAttachment>(
  {
    id: { type: String, required: true },
    key: { type: String, required: true, trim: true },
    originalName: { type: String, default: "", trim: true },
    contentType: { type: String, default: "", trim: true },
    size: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assetSchema = new Schema<IAsset>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assetCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    serialNumber: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "AssetCategory",
      default: null,
      index: true,
    },
    purchaseDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: 0, min: 0 },
    vendorName: { type: String, default: "", trim: true },
    invoiceReference: { type: String, default: "", trim: true },
    availableForUseDate: { type: Date, default: null },
    depreciation: { type: depreciationParamsSchema, default: () => ({}) },
    depreciationSchedule: { type: [scheduleRowSchema], default: [] },
    assignedEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "AssetLocation",
      default: null,
      index: true,
    },
    lifecycleStatus: {
      type: String,
      enum: ASSET_LIFECYCLE_STATUSES,
      default: "draft",
      index: true,
    },
    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: "in_storage",
      index: true,
    },
    warrantyExpiryDate: { type: Date, default: null },
    amcExpiryDate: { type: Date, default: null },
    repairs: { type: [repairSchema], default: [] },
    valueAdjustments: { type: [valueAdjustmentSchema], default: [] },
    disposal: { type: disposalSchema, default: null },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true }
);

assetSchema.index({ organizationId: 1, assetCode: 1 }, { unique: true });
assetSchema.index({ organizationId: 1, lifecycleStatus: 1, updatedAt: -1 });
assetSchema.index({
  name: "text",
  assetCode: "text",
  serialNumber: "text",
  vendorName: "text",
});

export const Asset = mongoose.model<IAsset>("Asset", assetSchema);
