import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IServiceAttachment extends Document {
  organizationId: Types.ObjectId;
  serviceRequestId: Types.ObjectId;
  serviceRecordId: Types.ObjectId | null;
  serviceActivityId: Types.ObjectId | null;
  key: string;
  bucket: string;
  originalName: string;
  contentType: string;
  size: number;
  description: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceAttachmentSchema = new Schema<IServiceAttachment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, index: true },
    serviceRecordId: { type: Schema.Types.ObjectId, ref: "ServiceRecord", default: null, index: true },
    serviceActivityId: { type: Schema.Types.ObjectId, ref: "ServiceActivity", default: null, index: true },
    key: { type: String, required: true, trim: true },
    bucket: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true }
);

serviceAttachmentSchema.index({ organizationId: 1, serviceRequestId: 1, createdAt: -1 });
serviceAttachmentSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export const ServiceAttachment = mongoose.model<IServiceAttachment>("ServiceAttachment", serviceAttachmentSchema);
