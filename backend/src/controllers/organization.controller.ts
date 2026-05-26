import type { Request, Response } from "express";
import crypto from "node:crypto";
import { createElement } from "react";
import mongoose from "mongoose";
import { OrganizationInvitationEmail } from "../emails/organization-invitation";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { OrganizationInvitation } from "../models/organization-invitation.model";
import {
  OrganizationMember,
  type OrganizationRole,
} from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import { sendEmail } from "../lib/email";
import { serializeEntitlements } from "../services/entitlement.service";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
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
          preferences: {
            primaryColor: normalizeHexColor(preferences.primaryColor),
            theme: preferences.theme === "light" ? "light" : "dark",
            colorTheme: stringValue(preferences.colorTheme) || "default",
            pricing: stringValue(preferences.pricing) || "INR",
            defaultTerms: stringValue(preferences.defaultTerms),
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
    const organization = (req as OrganizationRequest).organization;
    res.json({ organization, entitlements: serializeEntitlements(organization) });
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

    organization.set(input);
    await organization.save();
    res.json({ organization });
  } catch (err) {
    console.error("Error updating organization:", err);
    res.status(500).json({ error: "Failed to update organization" });
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

    res.json({ members });
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

    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
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

    const role = normalizeRole(req.body?.role);
    const member = await OrganizationMember.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { $set: { role } },
      { new: true }
    );

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    res.json({ member });
  } catch (err) {
    console.error("Error updating organization member:", err);
    res.status(500).json({ error: "Failed to update organization member" });
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
