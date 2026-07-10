import mongoose, { Schema, type Document, type Types } from "mongoose";
import { SERVICE_REQUEST_TYPES, SERVICE_SYSTEM_CATEGORIES, type ServiceRequestType, type ServiceSystemCategory } from "./service-request.model";

export interface IServiceRecord extends Document {
  organizationId: Types.ObjectId;
  serviceRequestId: Types.ObjectId;
  reference: string;
  sequenceNumber: number;
  fiscalYear: string;
  type: Exclude<ServiceRequestType, "service_request">;
  title: string;
  description: string;
  statusId: string;
  systemCategory: ServiceSystemCategory;
  assignedEmployeeIds: Types.ObjectId[];
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const childTypes = SERVICE_REQUEST_TYPES.filter((type) => type !== "service_request");
const serviceRecordSchema = new Schema<IServiceRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, index: true },
    reference: { type: String, required: true, trim: true },
    sequenceNumber: { type: Number, required: true },
    fiscalYear: { type: String, required: true, trim: true },
    type: { type: String, enum: childTypes, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "", trim: true, maxlength: 10000 },
    statusId: { type: String, required: true, trim: true, index: true },
    systemCategory: { type: String, enum: SERVICE_SYSTEM_CATEGORIES, default: "open", index: true },
    assignedEmployeeIds: { type: [{ type: Schema.Types.ObjectId, ref: "Employee" }], default: [] },
    scheduledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

serviceRecordSchema.index({ organizationId: 1, reference: 1 }, { unique: true });
serviceRecordSchema.index({ organizationId: 1, serviceRequestId: 1, createdAt: -1 });

export const ServiceRecord = mongoose.model<IServiceRecord>("ServiceRecord", serviceRecordSchema);
