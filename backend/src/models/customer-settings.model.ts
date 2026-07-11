import mongoose, { Schema, type Document, type Types } from "mongoose";

export const CUSTOMER_FIELD_TYPES = ["text", "number", "date", "boolean", "select"] as const;
export type CustomerFieldType = (typeof CUSTOMER_FIELD_TYPES)[number];

export const SPECIAL_DISCOUNT_FIELD_ID = "system.special_discount_percentage";

export interface ICustomerFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomerFieldType;
  options: string[];
  isActive: boolean;
  isSystem: boolean;
  showInList: boolean;
  order: number;
}

export interface ICustomerSettings extends Document {
  organizationId: Types.ObjectId;
  fieldDefinitions: ICustomerFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export const LEGACY_SPECIAL_DISCOUNT_FIELD: ICustomerFieldDefinition = {
  id: SPECIAL_DISCOUNT_FIELD_ID,
  key: "specialDiscountPercentage",
  label: "Special discount percentage",
  type: "number",
  options: [],
  isActive: true,
  isSystem: true,
  showInList: false,
  order: 10,
};

const customerFieldDefinitionSchema = new Schema<ICustomerFieldDefinition>(
  {
    id: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: CUSTOMER_FIELD_TYPES, required: true },
    options: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    showInList: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const customerSettingsSchema = new Schema<ICustomerSettings>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    fieldDefinitions: { type: [customerFieldDefinitionSchema], default: [] },
  },
  { timestamps: true }
);

export const CustomerSettings = mongoose.model<ICustomerSettings>(
  "CustomerSettings",
  customerSettingsSchema
);
