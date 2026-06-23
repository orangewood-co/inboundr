import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDashboardLayoutItem {
  id: string;
  hidden: boolean;
}

export interface IDashboardLayout extends Document {
  userId: string;
  organizationId: Types.ObjectId;
  items: IDashboardLayoutItem[];
  createdAt: Date;
  updatedAt: Date;
}

const dashboardLayoutItemSchema = new Schema<IDashboardLayoutItem>(
  {
    id: { type: String, required: true },
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const dashboardLayoutSchema = new Schema<IDashboardLayout>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    items: { type: [dashboardLayoutItemSchema], default: [] },
  },
  { timestamps: true }
);

dashboardLayoutSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const DashboardLayout = mongoose.model<IDashboardLayout>(
  "DashboardLayout",
  dashboardLayoutSchema
);
