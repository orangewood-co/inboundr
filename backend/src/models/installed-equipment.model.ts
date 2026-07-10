import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IInstalledEquipment extends Document {
  organizationId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerSiteId: Types.ObjectId | null;
  assetId: Types.ObjectId | null;
  name: string;
  modelName: string;
  serialNumber: string;
  manufacturer: string;
  installedAt: Date | null;
  warrantyExpiresAt: Date | null;
  notes: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const installedEquipmentSchema = new Schema<IInstalledEquipment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerSiteId: { type: Schema.Types.ObjectId, ref: "CustomerSite", default: null, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", default: null, index: true },
    name: { type: String, required: true, trim: true },
    modelName: { type: String, default: "", trim: true },
    serialNumber: { type: String, default: "", trim: true, index: true },
    manufacturer: { type: String, default: "", trim: true },
    installedAt: { type: Date, default: null },
    warrantyExpiresAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

installedEquipmentSchema.index({ organizationId: 1, customerId: 1, updatedAt: -1 });
installedEquipmentSchema.index(
  { organizationId: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $gt: "" } } }
);

export const InstalledEquipment = mongoose.model<IInstalledEquipment>("InstalledEquipment", installedEquipmentSchema);
