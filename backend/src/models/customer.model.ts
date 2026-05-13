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
    specialDiscountPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customerSchema.index({ company: 1, email: 1 });
customerSchema.index({ organizationId: 1, email: 1 });
customerSchema.index({ organizationId: 1, company: 1 });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
