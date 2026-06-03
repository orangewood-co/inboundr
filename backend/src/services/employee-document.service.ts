import type { Types } from "mongoose";
import { EmployeeDocument, type EmployeeDocumentType, type IEmployeeDocumentSnapshot } from "../models/employee-document.model";

export const EMPLOYEE_DOCUMENT_TYPES: EmployeeDocumentType[] = ["id_card", "proof_of_employment"];

export function employeeDocumentTitle(type: EmployeeDocumentType): string {
  return type === "id_card" ? "Employee ID Card" : "Proof of Employment";
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function dateTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function teamName(employee: any): string | null {
  if (!employee.teamId || typeof employee.teamId !== "object") return null;
  return normalizeNullableString(employee.teamId.name);
}

export function createEmployeeDocumentSnapshot(employee: any): IEmployeeDocumentSnapshot {
  return {
    fullName: String(employee.fullName ?? "").trim(),
    email: String(employee.email ?? "").trim().toLowerCase(),
    phone: normalizeNullableString(employee.phone),
    title: normalizeNullableString(employee.title),
    employeeCode: normalizeNullableString(employee.employeeCode),
    teamName: teamName(employee),
    startDate: employee.startDate ?? null,
    profileImageUrl: normalizeNullableString(employee.profileImageUrl),
  };
}

export function employeeDocumentSnapshotEquals(
  current: IEmployeeDocumentSnapshot | undefined,
  next: IEmployeeDocumentSnapshot
): boolean {
  if (!current) return false;
  return (
    current.fullName === next.fullName &&
    current.email === next.email &&
    (current.phone ?? null) === (next.phone ?? null) &&
    (current.title ?? null) === (next.title ?? null) &&
    (current.employeeCode ?? null) === (next.employeeCode ?? null) &&
    (current.teamName ?? null) === (next.teamName ?? null) &&
    (current.profileImageUrl ?? null) === (next.profileImageUrl ?? null) &&
    dateTime(current.startDate) === dateTime(next.startDate)
  );
}

export async function upsertEmployeeDocument(options: {
  organizationId: Types.ObjectId;
  employee: any;
  type: EmployeeDocumentType;
  generatedByUserId: string;
  force?: boolean;
}) {
  const { organizationId, employee, type, generatedByUserId, force = false } = options;
  const title = employeeDocumentTitle(type);
  const employeeSnapshot = createEmployeeDocumentSnapshot(employee);
  const existing = await EmployeeDocument.findOne({
    organizationId,
    employeeId: employee._id,
    type,
  }).sort({ createdAt: -1 });

  if (existing) {
    if (!force && existing.title === title && employeeDocumentSnapshotEquals(existing.employeeSnapshot, employeeSnapshot)) {
      return existing;
    }

    existing.title = title;
    existing.employeeSnapshot = employeeSnapshot;
    existing.issuedAt = new Date();
    existing.generatedByUserId = generatedByUserId;
    existing.html = null;
    await existing.save();
    return existing;
  }

  try {
    return await EmployeeDocument.create({
      organizationId,
      employeeId: employee._id,
      type,
      title,
      generatedByUserId,
      employeeSnapshot,
    });
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
    return EmployeeDocument.findOneAndUpdate(
      { organizationId, employeeId: employee._id, type },
      {
        $set: {
          title,
          generatedByUserId,
          employeeSnapshot,
          issuedAt: new Date(),
          html: null,
        },
      },
      { new: true, runValidators: true }
    );
  }
}

export async function ensureEmployeeDocuments(options: {
  organizationId: Types.ObjectId;
  employee: any;
  generatedByUserId: string;
  force?: boolean;
}) {
  const { organizationId, employee, generatedByUserId, force = false } = options;
  if (employee.status === "archived") return [];

  return Promise.all(
    EMPLOYEE_DOCUMENT_TYPES.map((type) =>
      upsertEmployeeDocument({
        organizationId,
        employee,
        type,
        generatedByUserId,
        force,
      })
    )
  );
}
