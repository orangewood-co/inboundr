import mongoose, { Schema, type Document, type Types } from "mongoose";
import {
  EMPLOYEE_ACCESS_MODULES,
  type EmployeeAccessModule,
} from "./employee-team.model";

export const ACCESS_GROUP_DEFAULT_KEYS = ["admin", "members"] as const;

export type AccessGroupDefaultKey = (typeof ACCESS_GROUP_DEFAULT_KEYS)[number];
export type AccessGroupStatus = "active" | "archived";

export interface IAccessGroup extends Document {
  organizationId: Types.ObjectId;
  name: string;
  description: string | null;
  moduleAccess: EmployeeAccessModule[];
  allModules: boolean;
  canManageOrganization: boolean;
  isDefault: boolean;
  defaultKey: AccessGroupDefaultKey | null;
  status: AccessGroupStatus;
  createdAt: Date;
  updatedAt: Date;
}

const accessGroupSchema = new Schema<IAccessGroup>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    moduleAccess: {
      type: [String],
      enum: EMPLOYEE_ACCESS_MODULES,
      default: [],
    },
    allModules: { type: Boolean, default: false },
    canManageOrganization: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false, index: true },
    defaultKey: {
      type: String,
      enum: [...ACCESS_GROUP_DEFAULT_KEYS, null],
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

accessGroupSchema.index(
  { organizationId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);
accessGroupSchema.index(
  { organizationId: 1, defaultKey: 1 },
  {
    unique: true,
    partialFilterExpression: { defaultKey: { $type: "string" } },
  }
);
accessGroupSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

export const AccessGroup = mongoose.model<IAccessGroup>(
  "AccessGroup",
  accessGroupSchema
);
