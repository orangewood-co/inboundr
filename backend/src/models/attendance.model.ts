import mongoose, { Schema, type Document, type Types } from "mongoose";

export type AttendanceAction = "check_in" | "check_out";
export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "missing_checkout" | "flagged";
export type AttendanceSource = "embed_pos" | "manual";

export interface IAttendanceLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: Date;
}

export interface IAttendanceFlags {
  locationMissing: boolean;
  selfieMissing: boolean;
  outsideAllowedRadius: boolean;
  duplicateAttempt: boolean;
  manualEdit: boolean;
}

export interface IAttendance extends Document {
  organizationId: Types.ObjectId;
  employeeId: Types.ObjectId;
  employeeCodeSnapshot: string | null;
  employeeNameSnapshot: string;
  workDate: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInLocation: IAttendanceLocation | null;
  checkOutLocation: IAttendanceLocation | null;
  checkInSelfieKey: string | null;
  checkOutSelfieKey: string | null;
  status: AttendanceStatus;
  source: AttendanceSource;
  flags: IAttendanceFlags;
  notes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceLocationSchema = new Schema<IAttendanceLocation>(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, default: null, min: 0 },
    capturedAt: { type: Date, required: true },
  },
  { _id: false }
);

const attendanceFlagsSchema = new Schema<IAttendanceFlags>(
  {
    locationMissing: { type: Boolean, default: false },
    selfieMissing: { type: Boolean, default: false },
    outsideAllowedRadius: { type: Boolean, default: false },
    duplicateAttempt: { type: Boolean, default: false },
    manualEdit: { type: Boolean, default: false },
  },
  { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
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
    employeeCodeSnapshot: { type: String, default: null, trim: true },
    employeeNameSnapshot: { type: String, required: true, trim: true },
    workDate: { type: String, required: true, trim: true, index: true },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    checkInLocation: { type: attendanceLocationSchema, default: null },
    checkOutLocation: { type: attendanceLocationSchema, default: null },
    checkInSelfieKey: { type: String, default: null, trim: true },
    checkOutSelfieKey: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half_day", "missing_checkout", "flagged"],
      default: "missing_checkout",
      index: true,
    },
    source: { type: String, enum: ["embed_pos", "manual"], default: "embed_pos" },
    flags: { type: attendanceFlagsSchema, default: () => ({}) },
    notes: { type: String, default: null, trim: true },
    reviewedByUserId: { type: String, default: null, trim: true },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

attendanceSchema.index({ organizationId: 1, employeeId: 1, workDate: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, workDate: -1, status: 1 });
attendanceSchema.index({ organizationId: 1, updatedAt: -1 });

export const Attendance = mongoose.model<IAttendance>("Attendance", attendanceSchema);
