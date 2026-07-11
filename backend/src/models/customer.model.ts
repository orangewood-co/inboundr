import mongoose, { Schema, type Document } from "mongoose";

export interface ICustomer extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  company: string;
  email: string;
  contactNumber: string | null;
  address: string | null;
  notes: string | null;
  specialDiscountPercentage: number;
  customFields: Map<string, string | number | boolean | null>;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String, required: true, index: true },
    contactNumber: { type: String, default: null },
    address: { type: String, default: null },
    notes: { type: String, default: null },
    specialDiscountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    customFields: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

customerSchema.index({ company: 1, email: 1 });
customerSchema.index({ organizationId: 1, email: 1 });
customerSchema.index({ organizationId: 1, company: 1 });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
