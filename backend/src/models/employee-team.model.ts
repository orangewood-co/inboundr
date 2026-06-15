import mongoose, { Schema, type Document, type Types } from "mongoose";

export const EMPLOYEE_ACCESS_MODULES = [
  "rfq",
  "inbox",
  "products",
  "customers",
  "invoices",
  "forms",
  "links",
  "drive",
  "stats",
  "employees",
  "projects",
  "chat",
  "support",
] as const;

export type EmployeeAccessModule = (typeof EMPLOYEE_ACCESS_MODULES)[number];
export type EmployeeTeamStatus = "active" | "archived";

export interface IEmployeeTeam extends Document {
  organizationId: Types.ObjectId;
  name: string;
  description: string | null;
  status: EmployeeTeamStatus;
  defaultModules: EmployeeAccessModule[];
  createdAt: Date;
  updatedAt: Date;
}

const employeeTeamSchema = new Schema<IEmployeeTeam>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    defaultModules: {
      type: [String],
      enum: EMPLOYEE_ACCESS_MODULES,
      default: [],
    },
  },
  { timestamps: true }
);

employeeTeamSchema.index(
  { organizationId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);
employeeTeamSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

export const EmployeeTeam = mongoose.model<IEmployeeTeam>(
  "EmployeeTeam",
  employeeTeamSchema
);
