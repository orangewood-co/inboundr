import mongoose, { Schema, type Document, type Types } from "mongoose";

export type EmployeeDocumentType = "id_card" | "proof_of_employment";

export interface IEmployeeDocumentSnapshot {
  fullName: string;
  email: string;
  phone: string | null;
  title: string | null;
  employeeCode: string | null;
  teamName: string | null;
  startDate: Date | null;
}

export interface IEmployeeDocument extends Document {
  organizationId: Types.ObjectId;
  employeeId: Types.ObjectId;
  type: EmployeeDocumentType;
  title: string;
  html: string | null;
  employeeSnapshot: IEmployeeDocumentSnapshot;
  issuedAt: Date;
  generatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const employeeDocumentSnapshotSchema = new Schema<IEmployeeDocumentSnapshot>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    title: { type: String, default: null },
    employeeCode: { type: String, default: null },
    teamName: { type: String, default: null },
    startDate: { type: Date, default: null },
  },
  { _id: false }
);

const employeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["id_card", "proof_of_employment"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    html: { type: String, default: null },
    employeeSnapshot: {
      type: employeeDocumentSnapshotSchema,
      required: true,
    },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    generatedByUserId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });
employeeDocumentSchema.index(
  { organizationId: 1, employeeId: 1, type: 1 },
  { unique: true }
);

export const EmployeeDocument = mongoose.model<IEmployeeDocument>(
  "EmployeeDocument",
  employeeDocumentSchema
);
