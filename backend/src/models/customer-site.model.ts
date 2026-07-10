import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ICustomerSite extends Document {
  organizationId: Types.ObjectId;
  customerId: Types.ObjectId;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSiteSchema = new Schema<ICustomerSite>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    postalCode: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    contactName: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", lowercase: true, trim: true },
    contactPhone: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

customerSiteSchema.index({ organizationId: 1, customerId: 1, name: 1 });

export const CustomerSite = mongoose.model<ICustomerSite>("CustomerSite", customerSiteSchema);
