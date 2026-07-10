import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IServiceActivity extends Document {
  organizationId: Types.ObjectId;
  serviceRequestId: Types.ObjectId | null;
  serviceRecordId: Types.ObjectId | null;
  action: string;
  message: string;
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const serviceActivitySchema = new Schema<IServiceActivity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", default: null, index: true },
    serviceRecordId: { type: Schema.Types.ObjectId, ref: "ServiceRecord", default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    message: { type: String, default: "", trim: true, maxlength: 5000 },
    actorId: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

serviceActivitySchema.index({ organizationId: 1, serviceRequestId: 1, createdAt: -1 });

export const ServiceActivity = mongoose.model<IServiceActivity>("ServiceActivity", serviceActivitySchema);
