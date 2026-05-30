import mongoose, { Schema, type Document, type Types } from "mongoose";
import {
  EMPLOYEE_ACCESS_MODULES,
  type EmployeeAccessModule,
} from "./employee-team.model";

export type EmployeeStatus = "active" | "inactive" | "terminated" | "archived";

export interface IEmployeeEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface IEmployeePlatformAccess {
  enabled: boolean;
  allowedModules: EmployeeAccessModule[];
  restrictedModules: EmployeeAccessModule[];
  invitedEmail: string | null;
  lastInvitedAt: Date | null;
}

export interface IEmployee extends Document {
  organizationId: Types.ObjectId;
  organizationMemberId: Types.ObjectId | null;
  teamId: Types.ObjectId | null;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  title: string | null;
  profileImageUrl: string | null;
  status: EmployeeStatus;
  startDate: Date | null;
  emergencyContact: IEmployeeEmergencyContact;
  platformAccess: IEmployeePlatformAccess;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const emergencyContactSchema = new Schema<IEmployeeEmergencyContact>(
  {
    name: { type: String, default: "", trim: true },
    relationship: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
  },
  { _id: false }
);

const platformAccessSchema = new Schema<IEmployeePlatformAccess>(
  {
    enabled: { type: Boolean, default: false },
    allowedModules: {
      type: [String],
      enum: EMPLOYEE_ACCESS_MODULES,
      default: [],
    },
    restrictedModules: {
      type: [String],
      enum: EMPLOYEE_ACCESS_MODULES,
      default: [],
    },
    invitedEmail: { type: String, default: null, lowercase: true, trim: true },
    lastInvitedAt: { type: Date, default: null },
  },
  { _id: false }
);

const employeeSchema = new Schema<IEmployee>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    organizationMemberId: {
      type: Schema.Types.ObjectId,
      ref: "OrganizationMember",
      default: null,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeTeam",
      default: null,
      index: true,
    },
    employeeCode: { type: String, default: null, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    title: { type: String, default: null, trim: true },
    profileImageUrl: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "terminated", "archived"],
      default: "active",
      index: true,
    },
    startDate: { type: Date, default: null },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
    platformAccess: { type: platformAccessSchema, default: () => ({}) },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

employeeSchema.index(
  { organizationId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["active", "inactive", "terminated"] } },
  }
);
employeeSchema.index(
  { organizationId: 1, employeeCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeCode: { $type: "string" },
      status: { $in: ["active", "inactive", "terminated"] },
    },
  }
);
employeeSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
employeeSchema.index({ organizationId: 1, teamId: 1, status: 1 });
employeeSchema.index({ fullName: "text", email: "text", title: "text", employeeCode: "text" });

export const Employee = mongoose.model<IEmployee>("Employee", employeeSchema);
