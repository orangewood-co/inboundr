import type { Request, Response } from "express";
import crypto from "node:crypto";
import { createElement } from "react";
import mongoose from "mongoose";
import { OrganizationInvitationEmail } from "../emails/organization-invitation";
import { frontendOrigin } from "../config/origins.config";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Employee, type EmployeeStatus } from "../models/employee.model";
import {
  EmployeeTeam,
  EMPLOYEE_ACCESS_MODULES,
  type EmployeeAccessModule,
} from "../models/employee-team.model";
import {
  OrganizationInvitation,
} from "../models/organization-invitation.model";
import {
  OrganizationMember,
  type OrganizationRole,
} from "../models/organization-member.model";
import { EmployeeDocument, type EmployeeDocumentType } from "../models/employee-document.model";
import { sendEmail } from "../lib/email";
import {
  EMPLOYEE_DOCUMENT_TYPES,
  ensureEmployeeDocuments,
  upsertEmployeeDocument,
} from "../services/employee-document.service";
import { streamEmployeeDocumentPdf } from "../services/employee-document-pdf.service";
import { generateVCardQrPng, loadPngBuffer } from "../services/pdf-image.service";

const SEARCH_FIELDS = ["fullName", "email", "phone", "title", "employeeCode"] as const;
const EMPLOYEE_STATUSES: EmployeeStatus[] = ["active", "inactive", "terminated", "archived"];
const VISIBLE_EMPLOYEE_ACCESS_MODULES = EMPLOYEE_ACCESS_MODULES.filter(
  (module) => module !== "inbox" && module !== "stats"
);

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableString(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized || null;
}

function socialUrl(value: unknown): string | null {
  const normalized = stringValue(value);
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function parseDate(value: unknown): Date | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeModules(value: unknown): EmployeeAccessModule[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter((module): module is EmployeeAccessModule => {
    return typeof module === "string" && EMPLOYEE_ACCESS_MODULES.includes(module as EmployeeAccessModule);
  });
}

function normalizeStatus(value: unknown, fallback: EmployeeStatus = "active"): EmployeeStatus {
  return EMPLOYEE_STATUSES.includes(value as EmployeeStatus)
    ? (value as EmployeeStatus)
    : fallback;
}

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function attendancePinHash(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function normalizeRole(value: unknown): OrganizationRole {
  return value === "owner" || value === "admin" ? value : "member";
}

async function findMemberByEmail(organizationId: mongoose.Types.ObjectId, email: string) {
  const db = mongoose.connection.db;
  if (!db || !email) return null;

  const user = await db.collection("user").findOne(
    { email: email.toLowerCase() },
    { projection: { id: 1, _id: 1, name: 1, email: 1 } }
  );
  if (!user) return null;

  return OrganizationMember.findOne({
    organizationId,
    userId: { $in: [user.id, String(user._id)].filter(Boolean) },
  });
}

async function ensureTeamBelongsToOrganization(
  organizationId: mongoose.Types.ObjectId,
  teamId: unknown
): Promise<mongoose.Types.ObjectId | null> {
  if (!teamId) return null;
  if (!isValidObjectId(String(teamId))) {
    throw new Error("Invalid team id");
  }

  const team = await EmployeeTeam.findOne({
    _id: String(teamId),
    organizationId,
    status: "active",
  }).select("_id");
  if (!team) {
    throw new Error("Team not found");
  }
  return team._id;
}

function normalizeEmployeeInput(body: Record<string, unknown>, partial = false) {
  const platformAccess = body.platformAccess as Record<string, unknown> | undefined;
  const emergencyContact = body.emergencyContact as Record<string, unknown> | undefined;
  const socials = body.socials as Record<string, unknown> | undefined;
  const address = body.address as Record<string, unknown> | undefined;
  const input: Record<string, unknown> = {};

  if (!partial || "fullName" in body) input.fullName = stringValue(body.fullName);
  if (!partial || "email" in body) input.email = stringValue(body.email).toLowerCase();
  if (!partial || "phone" in body) input.phone = nullableString(body.phone);
  if (!partial || "title" in body) input.title = nullableString(body.title);
  if (!partial || "employeeCode" in body) input.employeeCode = nullableString(body.employeeCode);
  if ("attendancePin" in body) {
    const attendancePin = stringValue(body.attendancePin);
    if (attendancePin) {
      if (/^\d{4,8}$/.test(attendancePin)) {
        input.attendancePinHash = attendancePinHash(attendancePin);
        input.attendancePinSetAt = new Date();
      } else {
        input.attendancePinHash = "";
      }
    }
  }
  if (!partial || "profileImageUrl" in body) input.profileImageUrl = nullableString(body.profileImageUrl);
  if (!partial || "startDate" in body) input.startDate = parseDate(body.startDate);
  if ("status" in body) input.status = normalizeStatus(body.status);

  if (!partial || socials) {
    input.socials = {
      linkedinUrl: socialUrl(socials?.linkedinUrl),
      instagramUrl: socialUrl(socials?.instagramUrl),
    };
  }

  if (!partial || address) {
    input.address = {
      line1: stringValue(address?.line1),
      line2: stringValue(address?.line2),
      city: stringValue(address?.city),
      state: stringValue(address?.state),
      postalCode: stringValue(address?.postalCode),
      country: stringValue(address?.country),
    };
  }

  if (emergencyContact) {
    input.emergencyContact = {
      name: stringValue(emergencyContact.name),
      relationship: stringValue(emergencyContact.relationship),
      phone: stringValue(emergencyContact.phone),
      email: stringValue(emergencyContact.email).toLowerCase(),
    };
  }

  if (platformAccess) {
    input.platformAccess = {
      enabled: platformAccess.enabled === true,
      allowedModules: normalizeModules(platformAccess.allowedModules),
      restrictedModules: normalizeModules(platformAccess.restrictedModules),
    };
  }

  return input;
}

function validateEmployeeInput(input: Record<string, unknown>): string | null {
  if ("fullName" in input && !input.fullName) return "Employee name is required";
  if ("email" in input && (!input.email || !String(input.email).includes("@"))) {
    return "A valid email is required";
  }
  if ("attendancePinHash" in input && !input.attendancePinHash) return "Attendance PIN must be 4 to 8 digits";
  const socials = input.socials as Record<string, unknown> | undefined;
  if (socials?.linkedinUrl && !isHttpUrl(String(socials.linkedinUrl))) {
    return "LinkedIn URL must be a valid website URL";
  }
  if (socials?.instagramUrl && !isHttpUrl(String(socials.instagramUrl))) {
    return "Instagram URL must be a valid website URL";
  }
  return null;
}

function serializeEmployee(employee: any) {
  const { attendancePinHash: _attendancePinHash, ...safeEmployee } = employee ?? {};
  const team = employee.teamId && typeof employee.teamId === "object"
    ? {
        _id: employee.teamId._id,
        name: employee.teamId.name,
        defaultModules: employee.teamId.defaultModules ?? [],
        status: employee.teamId.status,
      }
    : null;

  return {
    ...safeEmployee,
    attendancePinSet: Boolean(employee.attendancePinSetAt),
    teamId: team?._id ?? employee.teamId ?? null,
    team,
  };
}

function publicInvitation(invitation: any) {
  return {
    _id: invitation._id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export async function listEmployeeModules(_req: Request, res: Response): Promise<void> {
  res.json({
    modules: VISIBLE_EMPLOYEE_ACCESS_MODULES.map((key) => ({
      key,
      label: key === "rfq" ? "Quotation" : key.charAt(0).toUpperCase() + key.slice(1),
    })),
  });
}

export async function listEmployees(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 24, 60);
    const skip = (page - 1) * limit;
    const search = stringValue(req.query.search);
    const status = stringValue(req.query.status);
    const teamId = stringValue(req.query.teamId);

    const filter: Record<string, unknown> = {
      organizationId: organization._id,
      status: { $ne: "archived" },
    };
    if (status && EMPLOYEE_STATUSES.includes(status as EmployeeStatus)) {
      filter.status = status;
    }
    if (teamId && mongoose.Types.ObjectId.isValid(teamId)) {
      filter.teamId = teamId;
    }
    if (search) {
      filter.$or = SEARCH_FIELDS.map((field) => ({
        [field]: { $regex: search, $options: "i" },
      }));
    }

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate("teamId", "name defaultModules status")
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Employee.countDocuments(filter),
    ]);

    res.json({
      employees: employees.map(serializeEmployee),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing employees:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const body = req.body ?? {};
    const input = normalizeEmployeeInput(body);
    const validationError = validateEmployeeInput(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const teamId = await ensureTeamBelongsToOrganization(organization._id, body.teamId);
    const existingMember = await findMemberByEmail(organization._id, String(input.email));
    const employee = await Employee.create({
      ...input,
      organizationId: organization._id,
      teamId,
      organizationMemberId: existingMember?._id ?? null,
    });

    const hydrated = await Employee.findById(employee._id)
      .populate("teamId", "name defaultModules status")
      .lean();
    if (hydrated) {
      await ensureEmployeeDocuments({
        organizationId: organization._id,
        employee: hydrated,
        generatedByUserId: authReq.user.id,
      });
    }
    res.status(201).json(serializeEmployee(hydrated));
  } catch (err: any) {
    console.error("Error creating employee:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Employee email or code already exists" });
      return;
    }
    res.status(500).json({ error: err.message || "Failed to create employee" });
  }
}

export async function getEmployee(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const employee = await Employee.findOne({
      _id: id,
      organizationId: organization._id,
    })
      .populate("teamId", "name defaultModules status")
      .lean();
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json(serializeEmployee(employee));
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const body = req.body ?? {};
    const input = normalizeEmployeeInput(body, true);
    const validationError = validateEmployeeInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    if ("teamId" in body) {
      input.teamId = await ensureTeamBelongsToOrganization(organization._id, body.teamId);
    }

    if ("email" in input) {
      const existingMember = await findMemberByEmail(organization._id, String(input.email));
      input.organizationMemberId = existingMember?._id ?? null;
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      input,
      { new: true, runValidators: true }
    )
      .populate("teamId", "name defaultModules status")
      .lean();

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    await ensureEmployeeDocuments({
      organizationId: organization._id,
      employee,
      generatedByUserId: authReq.user.id,
    });

    res.json(serializeEmployee(employee));
  } catch (err: any) {
    console.error("Error updating employee:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Employee email or code already exists" });
      return;
    }
    res.status(500).json({ error: err.message || "Failed to update employee" });
  }
}

export async function archiveEmployee(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      {
        status: "archived",
        archivedAt: new Date(),
        "platformAccess.enabled": false,
      },
      { new: true }
    )
      .populate("teamId", "name defaultModules status")
      .lean();

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json({ message: "Employee archived", employee: serializeEmployee(employee) });
  } catch (err) {
    console.error("Error archiving employee:", err);
    res.status(500).json({ error: "Failed to archive employee" });
  }
}

export async function restoreEmployee(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { status: "active", archivedAt: null },
      { new: true }
    )
      .populate("teamId", "name defaultModules status")
      .lean();

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    await ensureEmployeeDocuments({
      organizationId: organization._id,
      employee,
      generatedByUserId: authReq.user.id,
    });

    res.json(serializeEmployee(employee));
  } catch (err) {
    console.error("Error restoring employee:", err);
    res.status(500).json({ error: "Failed to restore employee" });
  }
}

export async function inviteEmployee(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const employee = await Employee.findOne({ _id: id, organizationId: organization._id });
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const email = stringValue(req.body?.email || employee.email).toLowerCase();
    const role = normalizeRole(req.body?.role);
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }

    const existingMember = await findMemberByEmail(organization._id, email);
    if (existingMember) {
      employee.organizationMemberId = existingMember._id;
      employee.platformAccess.enabled = true;
      await employee.save();
      res.json({ employee, member: existingMember, linked: true });
      return;
    }

    await OrganizationInvitation.updateMany(
      { organizationId: organization._id, email, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } }
    );

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const invitation = await OrganizationInvitation.create({
      organizationId: organization._id,
      email,
      role,
      tokenHash: tokenHash(rawToken),
      invitedByUserId: authReq.user.id,
      invitedByName: authReq.user.name ?? "",
      invitedByEmail: authReq.user.email ?? "",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const inviteUrl = `${frontendOrigin}/invite/${encodeURIComponent(rawToken)}`;
    await sendEmail({
      to: email,
      subject: `Join ${organization.name} on BTSA`,
      react: createElement(OrganizationInvitationEmail, {
        organizationName: organization.name,
        inviterName: authReq.user.name,
        inviteUrl,
      }),
    });

    employee.platformAccess.enabled = true;
    employee.platformAccess.invitedEmail = email;
    employee.platformAccess.lastInvitedAt = new Date();
    await employee.save();

    res.status(201).json({
      employee,
      invitation: publicInvitation(invitation),
      linked: false,
    });
  } catch (err) {
    console.error("Error inviting employee:", err);
    res.status(500).json({ error: "Failed to invite employee" });
  }
}

export async function linkEmployeeMember(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = String(req.params.id ?? "");
    const memberId = stringValue(req.body?.memberId);
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(memberId)) {
      res.status(400).json({ error: "Invalid employee or member id" });
      return;
    }

    const member = await OrganizationMember.findOne({
      _id: memberId,
      organizationId: organization._id,
    });
    if (!member) {
      res.status(404).json({ error: "Organization member not found" });
      return;
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      {
        organizationMemberId: member._id,
        "platformAccess.enabled": true,
      },
      { new: true }
    )
      .populate("teamId", "name defaultModules status")
      .lean();

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json(serializeEmployee(employee));
  } catch (err) {
    console.error("Error linking employee member:", err);
    res.status(500).json({ error: "Failed to link employee member" });
  }
}

export async function listEmployeeTeams(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const teams = await EmployeeTeam.find({
      organizationId: organization._id,
      status: { $ne: "archived" },
    })
      .sort({ name: 1 })
      .lean();

    const counts = await Employee.aggregate([
      {
        $match: {
          organizationId: organization._id,
          status: { $ne: "archived" },
          teamId: { $ne: null },
        },
      },
      { $group: { _id: "$teamId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

    res.json({
      teams: teams.map((team) => ({
        ...team,
        employeeCount: countMap.get(String(team._id)) ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error listing employee teams:", err);
    res.status(500).json({ error: "Failed to fetch employee teams" });
  }
}

export async function createEmployeeTeam(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const name = stringValue(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Team name is required" });
      return;
    }

    const team = await EmployeeTeam.create({
      organizationId: organization._id,
      name,
      description: nullableString(req.body?.description),
      defaultModules: normalizeModules(req.body?.defaultModules),
    });

    res.status(201).json(team);
  } catch (err: any) {
    console.error("Error creating employee team:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Team name already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create employee team" });
  }
}

export async function updateEmployeeTeam(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid team id" });
      return;
    }

    const input: Record<string, unknown> = {};
    if ("name" in req.body) input.name = stringValue(req.body.name);
    if ("description" in req.body) input.description = nullableString(req.body.description);
    if ("defaultModules" in req.body) input.defaultModules = normalizeModules(req.body.defaultModules);
    if ("name" in input && !input.name) {
      res.status(400).json({ error: "Team name is required" });
      return;
    }

    const existingTeam = await EmployeeTeam.findOne({
      _id: id,
      organizationId: organization._id,
    }).lean();
    if (!existingTeam) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const team = await EmployeeTeam.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      input,
      { new: true, runValidators: true }
    ).lean();
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    if ("name" in input && existingTeam.name !== team.name) {
      const employees = await Employee.find({
        organizationId: organization._id,
        teamId: team._id,
        status: { $ne: "archived" },
      })
        .populate("teamId", "name")
        .lean();

      await Promise.all(
        employees.map((employee) =>
          ensureEmployeeDocuments({
            organizationId: organization._id,
            employee,
            generatedByUserId: authReq.user.id,
          })
        )
      );
    }

    res.json(team);
  } catch (err: any) {
    console.error("Error updating employee team:", err);
    if (err?.code === 11000) {
      res.status(409).json({ error: "Team name already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to update employee team" });
  }
}

export async function archiveEmployeeTeam(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid team id" });
      return;
    }

    const assignedEmployees = await Employee.countDocuments({
      organizationId: organization._id,
      teamId: id,
      status: { $ne: "archived" },
    });
    if (assignedEmployees > 0) {
      res.status(400).json({ error: "Reassign employees before archiving this team" });
      return;
    }

    const team = await EmployeeTeam.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { status: "archived" },
      { new: true }
    ).lean();
    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    res.json({ message: "Team archived", team });
  } catch (err) {
    console.error("Error archiving employee team:", err);
    res.status(500).json({ error: "Failed to archive employee team" });
  }
}

export async function generateEmployeeDocument(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const id = String(req.params.id ?? "");
    const type = stringValue(req.body?.type) as EmployeeDocumentType;
    if (!mongoose.Types.ObjectId.isValid(id) || !EMPLOYEE_DOCUMENT_TYPES.includes(type)) {
      res.status(400).json({ error: "Invalid employee id or document type" });
      return;
    }

    const employee = await Employee.findOne({
      _id: id,
      organizationId: organization._id,
      status: { $ne: "archived" },
    })
      .populate("teamId", "name")
      .lean();
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const document = await upsertEmployeeDocument({
      organizationId: organization._id,
      employee,
      type,
      generatedByUserId: authReq.user.id,
      force: true,
    });

    res.status(200).json({ document });
  } catch (err) {
    console.error("Error generating employee document:", err);
    res.status(500).json({ error: "Failed to generate employee document" });
  }
}

export async function listEmployeeDocuments(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const documents = await EmployeeDocument.find({
      organizationId: organization._id,
      employeeId: id,
    })
      .select("-html")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ documents });
  } catch (err) {
    console.error("Error listing employee documents:", err);
    res.status(500).json({ error: "Failed to fetch employee documents" });
  }
}

export async function downloadEmployeeDocumentPdf(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id, documentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id)) || !mongoose.Types.ObjectId.isValid(String(documentId))) {
      res.status(400).json({ error: "Invalid employee or document id" });
      return;
    }

    const document = await EmployeeDocument.findOne({
      _id: documentId,
      employeeId: id,
      organizationId: organization._id,
    }).lean();
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const [logoBuffer, photoBuffer, qrBuffer] = await Promise.all([
      loadPngBuffer(organization.logoUrl),
      loadPngBuffer(document.employeeSnapshot?.profileImageUrl),
      generateVCardQrPng(document.employeeSnapshot),
    ]);

    streamEmployeeDocumentPdf({
      document,
      organization: {
        name: organization.name,
        email: organization.defaultContact?.email,
        phoneNumber: organization.defaultContact?.phoneNumber,
        address: organization.address,
        website: organization.website,
        primaryColor: organization.preferences?.primaryColor,
        logoBuffer,
      },
      assets: { photoBuffer, qrBuffer },
      res,
      disposition: stringValue(req.query.inline) === "1" ? "inline" : "attachment",
    });
  } catch (err) {
    console.error("Error downloading employee document PDF:", err);
    res.status(500).json({ error: "Failed to fetch employee document" });
  }
}
