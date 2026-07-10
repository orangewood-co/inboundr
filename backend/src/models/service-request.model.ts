import mongoose, { Schema, type Document, type Types } from "mongoose";

export const SERVICE_SYSTEM_CATEGORIES = ["open", "waiting", "resolved", "closed", "cancelled"] as const;
export const SERVICE_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const SERVICE_REQUEST_TYPES = ["service_request", "service_visit", "spare_dispatch", "root_cause_analysis"] as const;

export type ServiceSystemCategory = (typeof SERVICE_SYSTEM_CATEGORIES)[number];
export type ServicePriority = (typeof SERVICE_PRIORITIES)[number];
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export interface IServiceRequest extends Document {
  organizationId: Types.ObjectId;
  reference: string;
  sequenceNumber: number;
  fiscalYear: string;
  type: ServiceRequestType;
  customerId: Types.ObjectId;
  customerSiteId: Types.ObjectId | null;
  installedEquipmentId: Types.ObjectId | null;
  customerSnapshot: { name: string; company: string; email: string };
  siteSnapshot: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  equipmentSnapshot: { name: string; model: string; modelName: string; serialNumber: string } | null;
  title: string;
  description: string;
  complaintType: string;
  priority: ServicePriority;
  statusId: string;
  systemCategory: ServiceSystemCategory;
  assignedEmployeeIds: Types.ObjectId[];
  coordinatorId: Types.ObjectId | null;
  engineerId: Types.ObjectId | null;
  sourceTicketId: Types.ObjectId | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  closure: {
    confirmedByCustomer: boolean;
    confirmationNote: string;
    waiverReason: string;
    closedBy: string | null;
    closedAt: Date | null;
  } | null;
  reopenedCount: number;
  lastActivityAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    reference: { type: String, required: true, trim: true },
    sequenceNumber: { type: Number, required: true },
    fiscalYear: { type: String, required: true, trim: true },
    type: { type: String, enum: SERVICE_REQUEST_TYPES, default: "service_request", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerSiteId: { type: Schema.Types.ObjectId, ref: "CustomerSite", default: null, index: true },
    installedEquipmentId: { type: Schema.Types.ObjectId, ref: "InstalledEquipment", default: null, index: true },
    customerSnapshot: {
      type: new Schema(
        {
          name: { type: String, default: "", trim: true },
          company: { type: String, default: "", trim: true },
          email: { type: String, default: "", trim: true },
        },
        { _id: false }
      ),
      required: true,
      immutable: true,
    },
    siteSnapshot: {
      type: new Schema(
        {
          name: { type: String, default: "", trim: true },
          address: { type: String, default: "", trim: true },
          city: { type: String, default: "", trim: true },
          state: { type: String, default: "", trim: true },
          postalCode: { type: String, default: "", trim: true },
          country: { type: String, default: "", trim: true },
        },
        { _id: false }
      ),
      default: null,
      immutable: true,
    },
    equipmentSnapshot: {
      type: new Schema(
        {
          name: { type: String, default: "", trim: true },
          model: { type: String, default: "", trim: true },
          modelName: { type: String, default: "", trim: true },
          serialNumber: { type: String, default: "", trim: true },
        },
        { _id: false }
      ),
      default: null,
      immutable: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "", trim: true, maxlength: 10000 },
    complaintType: { type: String, default: "", trim: true, index: true },
    priority: { type: String, enum: SERVICE_PRIORITIES, default: "medium", index: true },
    statusId: { type: String, required: true, trim: true, index: true },
    systemCategory: { type: String, enum: SERVICE_SYSTEM_CATEGORIES, default: "open", index: true },
    assignedEmployeeIds: { type: [{ type: Schema.Types.ObjectId, ref: "Employee" }], default: [], index: true },
    coordinatorId: { type: Schema.Types.ObjectId, ref: "Employee", default: null, index: true },
    engineerId: { type: Schema.Types.ObjectId, ref: "Employee", default: null, index: true },
    sourceTicketId: { type: Schema.Types.ObjectId, ref: "Ticket", default: null, index: true },
    dueAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    closure: {
      type: new Schema(
        {
          confirmedByCustomer: { type: Boolean, default: false },
          confirmationNote: { type: String, default: "", trim: true },
          waiverReason: { type: String, default: "", trim: true },
          closedBy: { type: String, default: null },
          closedAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    reopenedCount: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ organizationId: 1, reference: 1 }, { unique: true });
serviceRequestSchema.index({ organizationId: 1, systemCategory: 1, updatedAt: -1 });
serviceRequestSchema.index({ organizationId: 1, customerId: 1, createdAt: -1 });
serviceRequestSchema.index({ title: "text", description: "text", reference: "text" });

export const ServiceRequest = mongoose.model<IServiceRequest>("ServiceRequest", serviceRequestSchema);
