import crypto from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Attendance, type AttendanceAction, type AttendanceStatus, type IAttendanceLocation } from "../models/attendance.model";
import { Employee } from "../models/employee.model";
import { Organization } from "../models/organization.model";
import { createPresignedUpload, createPresignedViewUrl, keyBelongsToPrefix } from "../services/storage.service";

const ATTENDANCE_ACTIONS: AttendanceAction[] = ["check_in", "check_out"];
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "half_day", "missing_checkout", "flagged"];
const SELFIE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SELFIE_MAX_BYTES = 2 * 1024 * 1024;

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableString(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized || null;
}

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function todayWorkDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeWorkDate(value: unknown): string {
  const raw = stringValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayWorkDate();
}

function normalizeAction(value: unknown): AttendanceAction | null {
  return ATTENDANCE_ACTIONS.includes(value as AttendanceAction) ? (value as AttendanceAction) : null;
}

function normalizeStatus(value: unknown): AttendanceStatus {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus) ? (value as AttendanceStatus) : "present";
}

function parseDate(value: unknown): Date | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLocation(value: unknown): IAttendanceLocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const accuracy = input.accuracy === null || input.accuracy === undefined || input.accuracy === ""
    ? null
    : Number(input.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return null;
  const capturedAt = parseDate(input.capturedAt) ?? new Date();
  return { latitude, longitude, accuracy, capturedAt };
}

function verifyAttendancePin(pin: string, storedHash: string | null | undefined): boolean {
  if (!pin || !storedHash) return false;
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(pin, salt, 32).toString("hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

async function authenticatePublicEmployee(organizationId: string, body: Record<string, unknown>) {
  if (!isValidObjectId(organizationId)) {
    throw Object.assign(new Error("Invalid attendance workspace"), { statusCode: 400 });
  }

  const employeeCode = stringValue(body.employeeCode);
  const pin = stringValue(body.pin);
  if (!employeeCode || !pin) {
    throw Object.assign(new Error("Employee code and PIN are required"), { statusCode: 400 });
  }

  const organization = await Organization.findOne({ _id: organizationId, status: "active" }).lean();
  if (!organization) throw Object.assign(new Error("Attendance workspace not found"), { statusCode: 404 });

  const employee = await Employee.findOne({
    organizationId: organization._id,
    employeeCode,
    status: "active",
  })
    .select("+attendancePinHash")
    .lean();
  if (!employee || !verifyAttendancePin(pin, employee.attendancePinHash)) {
    throw Object.assign(new Error("Employee code or PIN is incorrect"), { statusCode: 401 });
  }

  return { organization, employee };
}

function publicEmployee(employee: any) {
  return {
    _id: String(employee._id),
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    title: employee.title ?? null,
  };
}

function nextAction(record: any | null): AttendanceAction {
  if (!record?.checkInAt) return "check_in";
  return record.checkOutAt ? "check_in" : "check_out";
}

function serializeAttendance(record: any) {
  return {
    ...record,
    selfiePreview: null,
  };
}

async function attendanceWithPreview(record: any) {
  const serialized = serializeAttendance(record);
  const key = record.checkOutSelfieKey ?? record.checkInSelfieKey;
  if (!key) return serialized;
  try {
    serialized.selfiePreview = (await createPresignedViewUrl(key)).url;
  } catch {
    serialized.selfiePreview = null;
  }
  return serialized;
}

async function resolveOrganizationLogoUrl(rawLogo: unknown): Promise<string> {
  const value = stringValue(rawLogo);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  try {
    return (await createPresignedViewUrl(value)).url;
  } catch {
    return "";
  }
}

export async function getPublicAttendanceWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = String(req.params.organizationId ?? "");
    if (!isValidObjectId(organizationId)) {
      res.status(400).json({ error: "Invalid attendance workspace" });
      return;
    }
    const organization = await Organization.findOne({ _id: organizationId, status: "active" }).lean();
    if (!organization) {
      res.status(404).json({ error: "Attendance workspace not found" });
      return;
    }
    res.json({
      organization: {
        _id: String(organization._id),
        name: organization.name,
        logoUrl: await resolveOrganizationLogoUrl(organization.logoUrl),
        primaryColor: organization.preferences?.primaryColor ?? "#f5b400",
      },
    });
  } catch (err) {
    console.error("Error fetching attendance workspace:", err);
    res.status(500).json({ error: "Failed to load attendance workspace" });
  }
}

export async function identifyPublicAttendanceEmployee(req: Request, res: Response): Promise<void> {
  try {
    const { organization, employee } = await authenticatePublicEmployee(String(req.params.organizationId ?? ""), req.body ?? {});
    const workDate = normalizeWorkDate(req.body?.workDate);
    const record = await Attendance.findOne({
      organizationId: organization._id,
      employeeId: employee._id,
      workDate,
    }).lean();

    res.json({
      employee: publicEmployee(employee),
      workDate,
      nextAction: nextAction(record),
      record,
      requirements: {
        location: true,
        selfie: true,
      },
    });
  } catch (err: any) {
    res.status(Number(err?.statusCode ?? 500)).json({ error: err.message || "Failed to identify employee" });
  }
}

export async function createPublicAttendanceSelfiePresign(req: Request, res: Response): Promise<void> {
  try {
    const { organization, employee } = await authenticatePublicEmployee(String(req.params.organizationId ?? ""), req.body ?? {});
    const action = normalizeAction(req.body?.action);
    if (!action) {
      res.status(400).json({ error: "Invalid attendance action" });
      return;
    }

    const fileName = stringValue(req.body?.fileName) || "attendance-selfie.jpg";
    const contentType = stringValue(req.body?.contentType).toLowerCase();
    const size = Number(req.body?.size ?? 0);
    if (!SELFIE_MIME_TYPES.includes(contentType)) {
      res.status(400).json({ error: "Selfie must be a PNG, JPG, or WebP image" });
      return;
    }
    if (!Number.isFinite(size) || size <= 0 || size > SELFIE_MAX_BYTES) {
      res.status(400).json({ error: "Selfie must be 2MB or smaller" });
      return;
    }

    const presigned = await createPresignedUpload({
      scope: "attendance",
      organizationId: String(organization._id),
      fileName,
      contentType,
      size,
      prefixParts: [String(employee._id), action],
    });
    res.json(presigned);
  } catch (err: any) {
    console.error("Error creating attendance selfie upload:", err);
    res.status(Number(err?.statusCode ?? 500)).json({ error: err.message || "Failed to create upload URL" });
  }
}

export async function markPublicAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { organization, employee } = await authenticatePublicEmployee(String(req.params.organizationId ?? ""), req.body ?? {});
    const action = normalizeAction(req.body?.action);
    const workDate = normalizeWorkDate(req.body?.workDate);
    const location = parseLocation(req.body?.location);
    const selfieKey = nullableString(req.body?.selfieKey);

    if (!action) {
      res.status(400).json({ error: "Invalid attendance action" });
      return;
    }
    if (!location) {
      res.status(400).json({ error: "Location is required" });
      return;
    }
    if (!selfieKey) {
      res.status(400).json({ error: "Selfie is required" });
      return;
    }
    if (!keyBelongsToPrefix(selfieKey, ["attendance", String(organization._id), String(employee._id), action])) {
      res.status(400).json({ error: "Selfie upload does not match this attendance action" });
      return;
    }

    const now = new Date();
    let record = await Attendance.findOne({
      organizationId: organization._id,
      employeeId: employee._id,
      workDate,
    });

    if (action === "check_in") {
      if (record?.checkInAt && !record.checkOutAt) {
        res.status(409).json({ error: "You are already checked in" });
        return;
      }
      if (record?.checkInAt && record.checkOutAt) {
        res.status(409).json({ error: "Attendance is already complete for today" });
        return;
      }

      record = await Attendance.create({
        organizationId: organization._id,
        employeeId: employee._id,
        employeeCodeSnapshot: employee.employeeCode,
        employeeNameSnapshot: employee.fullName,
        workDate,
        checkInAt: now,
        checkInLocation: location,
        checkInSelfieKey: selfieKey,
        status: "missing_checkout",
        source: "embed_pos",
      });
    } else {
      if (!record?.checkInAt) {
        res.status(400).json({ error: "Check in before checking out" });
        return;
      }
      if (record.checkOutAt) {
        res.status(409).json({ error: "You are already checked out" });
        return;
      }
      record.checkOutAt = now;
      record.checkOutLocation = location;
      record.checkOutSelfieKey = selfieKey;
      record.status = "present";
      await record.save();
    }

    res.status(action === "check_in" ? 201 : 200).json({
      employee: publicEmployee(employee),
      nextAction: nextAction(record),
      record,
    });
  } catch (err: any) {
    console.error("Error marking attendance:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Attendance is already marked for this employee today" });
      return;
    }
    res.status(Number(err?.statusCode ?? 500)).json({ error: err.message || "Failed to mark attendance" });
  }
}

export async function listAttendance(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const workDate = normalizeWorkDate(req.query.date);
    const records = await Attendance.find({ organizationId: organization._id, workDate })
      .sort({ checkInAt: 1, employeeNameSnapshot: 1 })
      .lean();
    const employees = await Employee.find({
      organizationId: organization._id,
      status: "active",
    })
      .select("_id employeeCode fullName title teamId profileImageUrl attendancePinSetAt")
      .sort({ fullName: 1 })
      .lean();
    const markedEmployeeIds = new Set(records.map((record) => String(record.employeeId)));
    const absentEmployees = employees.filter((employee) => !markedEmployeeIds.has(String(employee._id)));
    const summary = {
      present: records.filter((record) => record.status === "present").length,
      missingCheckout: records.filter((record) => record.status === "missing_checkout").length,
      flagged: records.filter((record) => record.status === "flagged").length,
      absent: absentEmployees.length,
      totalEmployees: employees.length,
    };

    res.json({
      date: workDate,
      summary,
      records: await Promise.all(records.map(attendanceWithPreview)),
      employees: employees.map((employee) => ({
        ...employee,
        attendancePinSet: Boolean(employee.attendancePinSetAt),
      })),
      absentEmployees,
    });
  } catch (err) {
    console.error("Error listing attendance:", err);
    res.status(500).json({ error: "Failed to list attendance" });
  }
}

export async function updateAttendance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid attendance id" });
      return;
    }

    const input: Record<string, unknown> = {
      notes: nullableString(req.body?.notes),
      status: normalizeStatus(req.body?.status),
      reviewedByUserId: authReq.user.id,
      reviewedAt: new Date(),
      "flags.manualEdit": true,
    };
    if ("checkInAt" in req.body) input.checkInAt = parseDate(req.body.checkInAt);
    if ("checkOutAt" in req.body) input.checkOutAt = parseDate(req.body.checkOutAt);

    const record = await Attendance.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      input,
      { new: true, runValidators: true }
    ).lean();
    if (!record) {
      res.status(404).json({ error: "Attendance record not found" });
      return;
    }
    res.json(await attendanceWithPreview(record));
  } catch (err) {
    console.error("Error updating attendance:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
}

export async function createManualAttendance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const employeeId = stringValue(req.body?.employeeId);
    if (!isValidObjectId(employeeId)) {
      res.status(400).json({ error: "Employee is required" });
      return;
    }
    const employee = await Employee.findOne({ _id: employeeId, organizationId: organization._id, status: { $ne: "archived" } }).lean();
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const workDate = normalizeWorkDate(req.body?.workDate);
    const checkInAt = parseDate(req.body?.checkInAt);
    const checkOutAt = parseDate(req.body?.checkOutAt);
    const record = await Attendance.create({
      organizationId: organization._id,
      employeeId: employee._id,
      employeeCodeSnapshot: employee.employeeCode,
      employeeNameSnapshot: employee.fullName,
      workDate,
      checkInAt,
      checkOutAt,
      status: normalizeStatus(req.body?.status),
      source: "manual",
      notes: nullableString(req.body?.notes),
      reviewedByUserId: authReq.user.id,
      reviewedAt: new Date(),
      flags: { manualEdit: true, locationMissing: true, selfieMissing: true },
    });
    res.status(201).json(await attendanceWithPreview(record.toObject()));
  } catch (err: any) {
    console.error("Error creating manual attendance:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Attendance already exists for this employee and date" });
      return;
    }
    res.status(500).json({ error: "Failed to create manual attendance" });
  }
}

export async function exportAttendanceCsv(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const workDate = normalizeWorkDate(req.query.date);
    const records = await Attendance.find({ organizationId: organization._id, workDate })
      .sort({ employeeNameSnapshot: 1 })
      .lean();
    const rows = [
      ["Employee", "Employee Code", "Date", "Status", "Check In", "Check Out", "Notes"],
      ...records.map((record) => [
        record.employeeNameSnapshot,
        record.employeeCodeSnapshot ?? "",
        record.workDate,
        record.status,
        record.checkInAt ? record.checkInAt.toISOString() : "",
        record.checkOutAt ? record.checkOutAt.toISOString() : "",
        record.notes ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${workDate}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("Error exporting attendance:", err);
    res.status(500).json({ error: "Failed to export attendance" });
  }
}
