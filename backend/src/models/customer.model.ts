import mongoose, { Schema, type Document } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  company: string;
  email: string;
  contactNumber: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true },
    company: { type: String, required: true },
    email: { type: String, required: true, index: true },
    contactNumber: { type: String, required: true },
    address: { type: String, required: true },
  },
  { timestamps: true }
);

customerSchema.index({ company: 1, email: 1 });

export const Customer = mongoose.model<ICustomer>("Customer", customerSchema);
