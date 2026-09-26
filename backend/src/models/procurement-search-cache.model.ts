import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { SupplierListing } from "../procurement/supplier-search.types";

export interface IProcurementSearchCache extends Document {
  organizationId: Types.ObjectId;
  provider: string;
  queryKey: string;
  listings: SupplierListing[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const procurementSearchCacheSchema = new Schema<IProcurementSearchCache>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    provider: { type: String, required: true },
    queryKey: { type: String, required: true },
    listings: { type: Schema.Types.Mixed, default: () => [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

procurementSearchCacheSchema.index({ organizationId: 1, provider: 1, queryKey: 1 }, { unique: true });
procurementSearchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProcurementSearchCache = mongoose.model<IProcurementSearchCache>(
  "ProcurementSearchCache",
  procurementSearchCacheSchema
);
