import mongoose, { Schema, type Document, type Types } from "mongoose";

export const PRODUCT_FIELD_TYPES = ["text", "number", "date", "boolean", "select"] as const;
export type ProductFieldType = (typeof PRODUCT_FIELD_TYPES)[number];

export interface IProductFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: ProductFieldType;
  options: string[];
  required: boolean;
  isActive: boolean;
  showInList: boolean;
  searchable: boolean;
  importAliases: string[];
  order: number;
}

export interface IProductAdjustmentDefinition {
  id: string;
  code: string;
  label: string;
  type: "fixed" | "percentage";
  defaultValue: number;
  taxable: boolean;
  isActive: boolean;
}

export interface IProductSearchSettings {
  synonyms: Record<string, string[]>;
  stopWords: string[];
  instructions: string;
  matchThreshold: number;
  ambiguityGap: number;
}

export interface IProductSettings extends Document {
  organizationId: Types.ObjectId;
  terminology: {
    singular: string;
    plural: string;
    skuLabel: string;
    manufacturerLabel: string;
    taxCodeLabel: string;
    taxRateLabel: string;
  };
  fieldDefinitions: IProductFieldDefinition[];
  adjustmentDefinitions: IProductAdjustmentDefinition[];
  search: IProductSearchSettings;
  createdAt: Date;
  updatedAt: Date;
}

const productFieldDefinitionSchema = new Schema<IProductFieldDefinition>(
  {
    id: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: PRODUCT_FIELD_TYPES, required: true },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    showInList: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
    importAliases: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const productAdjustmentDefinitionSchema = new Schema<IProductAdjustmentDefinition>(
  {
    id: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    defaultValue: { type: Number, default: 0, min: 0 },
    taxable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const productSettingsSchema = new Schema<IProductSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    terminology: {
      singular: { type: String, default: "Product", trim: true },
      plural: { type: String, default: "Products", trim: true },
      skuLabel: { type: String, default: "SKU", trim: true },
      manufacturerLabel: { type: String, default: "Manufacturer", trim: true },
      taxCodeLabel: { type: String, default: "Tax code", trim: true },
      taxRateLabel: { type: String, default: "Tax rate", trim: true },
    },
    fieldDefinitions: { type: [productFieldDefinitionSchema], default: [] },
    adjustmentDefinitions: { type: [productAdjustmentDefinitionSchema], default: [] },
    search: {
      synonyms: { type: Map, of: [String], default: () => new Map() },
      stopWords: { type: [String], default: [] },
      instructions: { type: String, default: "", trim: true, maxlength: 8000 },
      matchThreshold: { type: Number, default: 35, min: 0 },
      ambiguityGap: { type: Number, default: 30, min: 0 },
    },
  },
  { timestamps: true }
);

export const ProductSettings = mongoose.model<IProductSettings>(
  "ProductSettings",
  productSettingsSchema
);
