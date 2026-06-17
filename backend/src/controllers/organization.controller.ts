import type { Request, Response } from "express";
import crypto from "node:crypto";
import { createElement } from "react";
import mongoose from "mongoose";
import { OrganizationInvitationEmail } from "../emails/organization-invitation";
import { frontendOrigin } from "../config/origins.config";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { OrganizationInvitation } from "../models/organization-invitation.model";
import {
  OrganizationMember,
  type OrganizationRole,
} from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import { sendEmail } from "../lib/email";
import { normalizeTime, normalizeTimezone, sendHourUtcFromLocal } from "../lib/schedule";
import { serializeEntitlements } from "../services/entitlement.service";
import { getEmployeeAccessState } from "../services/employee-access.service";
import { keyBelongsToPrefix } from "../services/storage.service";

const LETTERHEAD_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const LETTERHEAD_MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_ORGANIZATION_LETTERHEADS = 10;

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function validationError(message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = 400;
  return error;
}

function httpError(message: string, statusCode: number): Error {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

function normalizePaymentTerms(value: unknown, defaultTerms: string) {
  if (!Array.isArray(value)) {
    return defaultTerms
      ? [
          {
            id: crypto.randomUUID(),
            name: "Default",
            text: defaultTerms,
            isDefault: true,
          },
        ]
      : [];
  }

  const seenNames = new Set<string>();
  const terms = value.map((item, index) => {
    const source = item as Record<string, unknown>;
    const name = stringValue(source.name);
    const text = stringValue(source.text);

    if (!name) throw validationError("Payment term name is required");
    if (!text) throw validationError("Payment term text is required");

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) {
      throw validationError(`Duplicate payment term name: ${name}`);
    }
    seenNames.add(normalizedName);

    return {
      id: stringValue(source.id) || crypto.randomUUID(),
      name,
      text,
      isDefault: Boolean(source.isDefault),
      _index: index,
    };
  });

  if (terms.length > 0) {
    const defaultCount = terms.filter((term) => term.isDefault).length;
    if (defaultCount !== 1) {
      throw validationError("Exactly one payment term must be marked as default");
    }
  }

  return terms.map(({ _index, ...term }) => term);
}

function normalizeDeliveryTerms(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenNames = new Set<string>();
  const terms = value.map((item, index) => {
    const source = item as Record<string, unknown>;
    const name = stringValue(source.name);
    const text = stringValue(source.text);

    if (!name) throw validationError("Delivery term name is required");
    if (!text) throw validationError("Delivery term text is required");

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) {
      throw validationError(`Duplicate delivery term name: ${name}`);
    }
    seenNames.add(normalizedName);

    return {
      id: stringValue(source.id) || crypto.randomUUID(),
      name,
      text,
      isDefault: Boolean(source.isDefault),
      _index: index,
    };
  });

  if (terms.length > 0) {
    const defaultCount = terms.filter((term) => term.isDefault).length;
    if (defaultCount !== 1) {
      throw validationError("Exactly one delivery term must be marked as default");
    }
  }

  return terms.map(({ _index, ...term }) => term);
}

async function resolveUsersByIds(userIds: string[]) {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) {
    return new Map<string, { name?: string; email?: string; lastSignInAt?: Date; image?: string }>();
  }

  const objectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const users = await db
    .collection("user")
    .find({
      $or: [
        { id: { $in: userIds } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    })
    .project({ id: 1, name: 1, email: 1, lastSignInAt: 1, image: 1 })
    .toArray();

  const map = new Map<string, { name?: string; email?: string; lastSignInAt?: Date; image?: string }>();
  for (const user of users) {
    map.set(user.id as string, user);
    map.set(String(user._id), user);
  }
  return map;
}

const MAX_REMINDER_OFFSET_DAYS = 365;

function normalizePaymentReminders(value: unknown) {
  const source = (value ?? {}) as Record<string, unknown>;
  const offsets = Array.isArray(source.offsets)
    ? [
        ...new Set(
          source.offsets
            .map((item) => Number(item))
            .filter((offset) => Number.isInteger(offset) && offset >= 0 && offset <= MAX_REMINDER_OFFSET_DAYS)
        ),
      ].sort((a, b) => a - b)
    : [0, 7, 14];

  if (Boolean(source.enabled) && offsets.length === 0) {
    throw validationError("Select at least one reminder schedule");
  }

  const sendTimeLocal = normalizeTime(source.sendTimeLocal, "10:00");
  const timezone = normalizeTimezone(source.timezone);

  return {
    enabled: Boolean(source.enabled),
    offsets,
    sendTimeLocal,
    timezone,
    sendHourUtc: sendHourUtcFromLocal(sendTimeLocal, timezone),
  };
}

function normalizeUpiId(value: unknown): string {
  const upiId = stringValue(value).toLowerCase();
  if (!upiId) return "";
  if (!/^[a-z0-9][a-z0-9._-]*@[a-z][a-z0-9]*$/.test(upiId)) {
    throw validationError("UPI ID must look like name@bank (e.g. business@upi)");
  }
  return upiId;
}

function normalizeHexColor(value: unknown): string {
  const color = stringValue(value);
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "#f5b400";
}

function normalizeOrganizationInput(body: Record<string, unknown>) {
  const defaultContact = body.defaultContact as Record<string, unknown> | undefined;
  const preferences = body.preferences as Record<string, unknown> | undefined;
  const defaultTerms = preferences ? stringValue(preferences.defaultTerms) : "";

  return {
    ...(body.name !== undefined ? { name: stringValue(body.name) } : {}),
    ...(body.website !== undefined ? { website: stringValue(body.website) } : {}),
    ...(body.logoUrl !== undefined ? { logoUrl: stringValue(body.logoUrl) } : {}),
    ...(body.address !== undefined ? { address: stringValue(body.address) } : {}),
    ...(defaultContact
      ? {
          defaultContact: {
            name: stringValue(defaultContact.name),
            email: stringValue(defaultContact.email).toLowerCase(),
            phoneNumber: stringValue(defaultContact.phoneNumber),
          },
        }
      : {}),
    ...(preferences
      ? {
          // Only fields present in the payload are included, so partial saves
          // (e.g. the notifications tab sending just paymentReminders) don't
          // reset the rest of the organization preferences.
          preferences: {
            ...(preferences.primaryColor !== undefined
              ? { primaryColor: normalizeHexColor(preferences.primaryColor) }
              : {}),
            ...(preferences.theme !== undefined
              ? { theme: preferences.theme === "light" ? "light" : "dark" }
              : {}),
            ...(preferences.colorTheme !== undefined
              ? { colorTheme: stringValue(preferences.colorTheme) || "default" }
              : {}),
            ...(preferences.pricing !== undefined
              ? { pricing: stringValue(preferences.pricing) || "INR" }
              : {}),
            ...(preferences.defaultTerms !== undefined || preferences.paymentTerms !== undefined
              ? {
                  defaultTerms,
                  paymentTerms: normalizePaymentTerms(preferences.paymentTerms, defaultTerms),
                }
              : {}),
            ...(preferences.deliveryTerms !== undefined
              ? { deliveryTerms: normalizeDeliveryTerms(preferences.deliveryTerms) }
              : {}),
            ...(preferences.defaultUpiId !== undefined
              ? { defaultUpiId: normalizeUpiId(preferences.defaultUpiId) }
              : {}),
            ...(preferences.paymentReminders !== undefined
              ? { paymentReminders: normalizePaymentReminders(preferences.paymentReminders) }
              : {}),
          },
        }
      : {}),
  };
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeRole(value: unknown): OrganizationRole {
  return value === "owner" || value === "admin" ? value : "member";
}

function normalizeManageableRole(value: unknown): Exclude<OrganizationRole, "owner"> | null {
  if (value === "admin" || value === "member") return value;
  return null;
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

export async function getMyOrganization(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const employeeAccess = await getEmployeeAccessState({
      organizationId: organization._id,
      organizationMemberId: orgReq.organizationMembership?._id ?? null,
      role: orgReq.organizationMembership.role,
    });

    res.json({
      organization,
      entitlements: serializeEntitlements(organization),
      employeeAccess,
    });
  } catch (err) {
    console.error("Error fetching organization:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
}

export async function updateMyOrganization(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const input = normalizeOrganizationInput(req.body ?? {});

    if ("name" in input && !input.name) {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    if (input.preferences) {
      // Merge over the stored preferences so omitted fields keep their values.
      const current =
        typeof (organization.preferences as any)?.toObject === "function"
          ? (organization.preferences as any).toObject()
          : organization.preferences ?? {};
      input.preferences = { ...current, ...input.preferences };
    }

    organization.set(input);
    await organization.save();
    res.json({ organization });
  } catch (err) {
    console.error("Error updating organization:", err);
    const statusCode = (err as any)?.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? (err as Error).message : "Failed to update organization",
    });
  }
}

export async function addOrganizationLetterhead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const key = stringValue(req.body?.key);
    const originalName = stringValue(req.body?.originalName);
    const contentType = stringValue(req.body?.contentType).toLowerCase();
    const size = Number(req.body?.size ?? 0);

    if (!key) {
      res.status(400).json({ error: "Letterhead file key is required" });
      return;
    }

    if (!keyBelongsToPrefix(key, ["letterhead", String(organization._id)])) {
      res.status(400).json({ error: "Letterhead file does not belong to this organization" });
      return;
    }

    if (!LETTERHEAD_ALLOWED_MIME_TYPES.includes(contentType)) {
      res.status(400).json({ error: "This file type is not allowed" });
      return;
    }

    if (!Number.isFinite(size) || size <= 0 || size > LETTERHEAD_MAX_FILE_SIZE) {
      res.status(400).json({ error: "Letterhead must be 2MB or smaller" });
      return;
    }

    if (organization.letterheads.length >= MAX_ORGANIZATION_LETTERHEADS) {
      res.status(400).json({ error: `Organizations can save up to ${MAX_ORGANIZATION_LETTERHEADS} letterheads` });
      return;
    }

    if (organization.letterheads.some((letterhead) => letterhead.key === key)) {
      res.status(409).json({ error: "Letterhead has already been added" });
      return;
    }

    const letterhead = {
      id: crypto.randomUUID(),
      key,
      originalName,
      contentType,
      size,
      createdAt: new Date(),
    };

    organization.letterheads.push(letterhead);
    if (!organization.activeLetterheadId) {
      organization.activeLetterheadId = letterhead.id;
    }

    await organization.save();
    res.status(201).json({ organization });
  } catch (err) {
    console.error("Error adding organization letterhead:", err);
    res.status(500).json({ error: "Failed to add letterhead" });
  }
}

export async function setActiveOrganizationLetterhead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id } = req.params;
    const letterhead = organization.letterheads.find((item) => item.id === id);

    if (!letterhead) {
      res.status(404).json({ error: "Letterhead not found" });
      return;
    }

    organization.activeLetterheadId = letterhead.id;
    await organization.save();
    res.json({ organization });
  } catch (err) {
    console.error("Error setting active organization letterhead:", err);
    res.status(500).json({ error: "Failed to set active letterhead" });
  }
}

export async function deleteOrganizationLetterhead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id } = req.params;
    const existing = organization.letterheads.find((letterhead) => letterhead.id === id);

    if (!existing) {
      res.status(404).json({ error: "Letterhead not found" });
      return;
    }

    organization.letterheads = organization.letterheads.filter((letterhead) => letterhead.id !== id);

    if (organization.activeLetterheadId === id) {
      const newest = organization.letterheads.reduce<typeof organization.letterheads[number] | null>(
        (current, letterhead) => {
          if (!current) return letterhead;
          return letterhead.createdAt > current.createdAt ? letterhead : current;
        },
        null
      );
      organization.activeLetterheadId = newest?.id ?? "";
    }

    await organization.save();
    res.json({ organization });
  } catch (err) {
    console.error("Error deleting organization letterhead:", err);
    res.status(500).json({ error: "Failed to delete letterhead" });
  }
}

export async function listOrganizationMembers(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const members = await OrganizationMember.find({ organizationId: organization._id })
      .sort({ createdAt: 1 })
      .lean();

    const userIds = members.map((m) => m.userId);
    const users = await resolveUsersByIds(userIds);

    const enriched = members.map((member) => {
      const user = users.get(member.userId);
      return {
        ...member,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        userImage: user?.image ?? null,
        lastSignInAt: user?.lastSignInAt ?? null,
      };
    });

    res.json({ members: enriched });
  } catch (err) {
    console.error("Error listing organization members:", err);
    res.status(500).json({ error: "Failed to list organization members" });
  }
}

export async function listOrganizationInvitations(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const invitations = await OrganizationInvitation.find({
      organizationId: organization._id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invitations: invitations.map(publicInvitation) });
  } catch (err) {
    console.error("Error listing organization invitations:", err);
    res.status(500).json({ error: "Failed to list organization invitations" });
  }
}

export async function inviteOrganizationMember(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const organization = authReq.organization;
    const email = stringValue(req.body?.email).toLowerCase();
    const role = normalizeRole(req.body?.role);

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }

    const existingMember = await OrganizationMember.findOne({
      organizationId: organization._id,
      userId: email,
    });
    if (existingMember) {
      res.status(409).json({ error: "User is already a member" });
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

    res.status(201).json({ invitation: publicInvitation(invitation) });
  } catch (err) {
    console.error("Error inviting organization member:", err);
    res.status(500).json({ error: "Failed to invite organization member" });
  }
}

export async function previewOrganizationInvitation(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const token = stringValue(req.query.token);
    if (!token) {
      res.status(400).json({ error: "Invitation token is required" });
      return;
    }

    const invitation = await OrganizationInvitation.findOne({
      tokenHash: tokenHash(token),
    }).lean();

    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    const organization = await Organization.findById(invitation.organizationId)
      .select("name")
      .lean();

    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    res.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        status:
          invitation.status === "pending" && invitation.expiresAt.getTime() < Date.now()
            ? "expired"
            : invitation.status,
        expiresAt: invitation.expiresAt,
        organization: {
          _id: organization._id,
          name: organization.name,
        },
        inviter: {
          name: invitation.invitedByName,
          email: invitation.invitedByEmail,
        },
      },
    });
  } catch (err) {
    console.error("Error previewing organization invitation:", err);
    res.status(500).json({ error: "Failed to preview organization invitation" });
  }
}

export async function acceptOrganizationInvitation(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as OrganizationRequest;
    const token = stringValue(req.body?.token);
    if (!token) {
      res.status(400).json({ error: "Invitation token is required" });
      return;
    }

    const invitation = await OrganizationInvitation.findOne({
      tokenHash: tokenHash(token),
      status: "pending",
    });

    if (!invitation || invitation.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "Invitation is invalid or expired" });
      return;
    }

    if ((authReq.user.email ?? "").toLowerCase() !== invitation.email) {
      res.status(403).json({ error: "Sign in with the invited email address" });
      return;
    }

    await OrganizationMember.updateOne(
      { organizationId: invitation.organizationId, userId: authReq.user.id },
      { $setOnInsert: { role: invitation.role } },
      { upsert: true }
    );

    if (invitation.role === "owner") {
      await Organization.updateOne(
        {
          _id: invitation.organizationId,
          ownerUserId: /^pending-owner:/,
        },
        { $set: { ownerUserId: authReq.user.id } }
      );
    }

    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    res.json({ ok: true, organizationId: invitation.organizationId });
  } catch (err) {
    console.error("Error accepting organization invitation:", err);
    res.status(500).json({ error: "Failed to accept organization invitation" });
  }
}

export async function cancelOrganizationInvitation(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id } = req.params;
    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid invitation id" });
      return;
    }

    const invitation = await OrganizationInvitation.findOneAndUpdate(
      { _id: id, organizationId: organization._id, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { new: true }
    );

    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    res.json({ invitation: publicInvitation(invitation) });
  } catch (err) {
    console.error("Error cancelling organization invitation:", err);
    res.status(500).json({ error: "Failed to cancel organization invitation" });
  }
}

export async function updateOrganizationMemberRole(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id } = req.params;
    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const role = normalizeManageableRole(req.body?.role);
    if (!role) {
      res.status(400).json({ error: "Use ownership transfer to change organization owners" });
      return;
    }

    const existing = await OrganizationMember.findOne({
      _id: id,
      organizationId: organization._id,
    });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (existing.role === "owner") {
      res.status(400).json({ error: "Use ownership transfer before changing the owner role" });
      return;
    }

    const member = await OrganizationMember.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { $set: { role } },
      { new: true }
    );

    res.json({ member });
  } catch (err) {
    console.error("Error updating organization member:", err);
    res.status(500).json({ error: "Failed to update organization member" });
  }
}

export async function transferOrganizationOwnership(
  req: Request,
  res: Response
): Promise<void> {
  const mongoSession = await mongoose.startSession();

  try {
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const currentOwnerUserId = orgReq.user.id;
    const { id } = req.params;

    if (organization.ownerUserId !== currentOwnerUserId) {
      res.status(403).json({ error: "Only the current owner can transfer ownership" });
      return;
    }

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    let newOwnerUserId = "";

    await mongoSession.withTransaction(async () => {
      const targetMember = await OrganizationMember.findOne({
        _id: id,
        organizationId: organization._id,
      }).session(mongoSession);

      if (!targetMember) throw httpError("Member not found", 404);
      if (targetMember.userId === currentOwnerUserId || targetMember.role === "owner") {
        throw httpError("This member is already the owner", 400);
      }

      const ownedOrganization = await Organization.findOne({
        _id: { $ne: organization._id },
        ownerUserId: targetMember.userId,
      }).session(mongoSession);
      if (ownedOrganization) {
        throw httpError("This member already owns another organization", 409);
      }

      const ownerUpdate = await Organization.updateOne(
        { _id: organization._id, ownerUserId: currentOwnerUserId },
        { $set: { ownerUserId: targetMember.userId } },
        { session: mongoSession }
      );
      if (ownerUpdate.modifiedCount !== 1) {
        throw httpError("Only the current owner can transfer ownership", 403);
      }

      await OrganizationMember.updateMany(
        { organizationId: organization._id, role: "owner" },
        { $set: { role: "admin" } },
        { session: mongoSession }
      );
      targetMember.role = "owner";
      await targetMember.save({ session: mongoSession });
      newOwnerUserId = targetMember.userId;
    });

    const [updatedOrganization, updatedMember] = await Promise.all([
      Organization.findById(organization._id),
      OrganizationMember.findOne({ organizationId: organization._id, userId: newOwnerUserId }),
    ]);

    res.json({
      organization: updatedOrganization ?? organization,
      member: updatedMember,
    });
  } catch (err: any) {
    console.error("Error transferring organization ownership:", err);
    const statusCode = err?.statusCode || (err?.code === 11000 ? 409 : 500);
    res.status(statusCode).json({
      error:
        statusCode === 500
          ? "Failed to transfer organization ownership"
          : err.message || "Failed to transfer organization ownership",
    });
  } finally {
    await mongoSession.endSession();
  }
}

export async function removeOrganizationMember(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const { id } = req.params;
    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const member = await OrganizationMember.findOne({
      _id: id,
      organizationId: organization._id,
    });

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (member.role === "owner") {
      res.status(400).json({ error: "Owner members cannot be removed" });
      return;
    }

    await member.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error("Error removing organization member:", err);
    res.status(500).json({ error: "Failed to remove organization member" });
  }
}
