import type { Request, Response } from "express";
import crypto from "node:crypto";
import { createElement } from "react";
import mongoose from "mongoose";
import { OrganizationInvitationEmail } from "../emails/organization-invitation";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { isPlatformAdmin } from "../middleware/auth.middleware";
import { sendEmail } from "../lib/email";
import { OrganizationInvitation } from "../models/organization-invitation.model";
import {
  OrganizationMember,
  type OrganizationRole,
} from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import {
  FEATURE_CATALOG,
  PLAN_DEFINITIONS,
  getPlanDefinition,
  normalizeFeatures,
  serializeEntitlements,
} from "../services/entitlement.service";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
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

async function getUsersByIds(userIds: string[]) {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) return new Map<string, any>();

  const users = await db
    .collection("user")
    .find({ id: { $in: userIds } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();

  return new Map(users.map((user) => [user.id as string, user]));
}

async function createInvitation({
  organization,
  email,
  role,
  inviter,
}: {
  organization: any;
  email: string;
  role: OrganizationRole;
  inviter: AuthenticatedRequest["user"];
}) {
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
    invitedByUserId: inviter.id,
    invitedByName: inviter.name ?? "",
    invitedByEmail: inviter.email ?? "",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  const inviteUrl = `${frontendOrigin}/invite/${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: email,
    subject: `Join ${organization.name} on BTSA`,
    react: createElement(OrganizationInvitationEmail, {
      organizationName: organization.name,
      inviterName: inviter.name,
      inviteUrl,
    }),
  });

  return invitation;
}

function serializeOrganization(organization: any, owner?: any, memberCount = 0) {
  return {
    _id: organization._id,
    name: organization.name,
    ownerUserId: organization.ownerUserId,
    owner: owner
      ? { id: owner.id, name: owner.name ?? "", email: owner.email ?? "" }
      : null,
    status: organization.status ?? "active",
    memberCount,
    defaultContact: organization.defaultContact,
    website: organization.website,
    logoUrl: organization.logoUrl,
    address: organization.address,
    preferences: organization.preferences,
    entitlements: serializeEntitlements(organization),
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

export async function getAdminMe(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  res.json({ isSuperAdmin: await isPlatformAdmin(user) });
}

export async function getAdminPlans(_req: Request, res: Response): Promise<void> {
  res.json({ features: FEATURE_CATALOG, plans: PLAN_DEFINITIONS });
}

export async function listAdminOrganizations(_req: Request, res: Response): Promise<void> {
  try {
    const organizations = await Organization.find({}).sort({ createdAt: -1 }).lean();
    const orgIds = organizations.map((org) => org._id);
    const memberCounts = await OrganizationMember.aggregate([
      { $match: { organizationId: { $in: orgIds } } },
      { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(memberCounts.map((row) => [row._id.toString(), row.count]));
    const users = await getUsersByIds(organizations.map((org) => org.ownerUserId));

    res.json({
      organizations: organizations.map((organization) =>
        serializeOrganization(
          organization,
          users.get(organization.ownerUserId),
          countMap.get(organization._id.toString()) ?? 0
        )
      ),
    });
  } catch (err) {
    console.error("Error listing admin organizations:", err);
    res.status(500).json({ error: "Failed to list organizations" });
  }
}

export async function createAdminOrganization(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const name = stringValue(req.body?.name);
    const ownerEmail = stringValue(req.body?.ownerEmail).toLowerCase();
    const planSlug = getPlanDefinition(stringValue(req.body?.planSlug)).slug;
    const organizationId = new mongoose.Types.ObjectId();

    if (!name) {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    const organization = await Organization.create({
      _id: organizationId,
      name,
      ownerUserId: `pending-owner:${organizationId.toString()}`,
      planSlug,
      enabledFeatures: normalizeFeatures(req.body?.enabledFeatures),
      disabledFeatures: normalizeFeatures(req.body?.disabledFeatures),
      defaultContact: { email: ownerEmail },
    });

    let invitation = null;
    if (ownerEmail) {
      invitation = await createInvitation({
        organization,
        email: ownerEmail,
        role: "owner",
        inviter: authReq.user,
      });
    }

    res.status(201).json({
      organization: serializeOrganization(organization.toObject(), undefined, 0),
      invitation: invitation ? publicInvitation(invitation) : null,
    });
  } catch (err) {
    console.error("Error creating admin organization:", err);
    res.status(500).json({ error: "Failed to create organization" });
  }
}

export async function getAdminOrganization(req: Request, res: Response): Promise<void> {
  try {
    const id = stringValue(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }

    const organization = await Organization.findById(id).lean();
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const [members, invitations, users] = await Promise.all([
      OrganizationMember.find({ organizationId: organization._id }).sort({ createdAt: 1 }).lean(),
      OrganizationInvitation.find({ organizationId: organization._id, status: "pending" }).sort({ createdAt: -1 }).lean(),
      getUsersByIds([organization.ownerUserId]),
    ]);

    res.json({
      organization: serializeOrganization(organization, users.get(organization.ownerUserId), members.length),
      members,
      invitations: invitations.map(publicInvitation),
    });
  } catch (err) {
    console.error("Error fetching admin organization:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
}

export async function updateAdminOrganization(req: Request, res: Response): Promise<void> {
  try {
    const id = stringValue(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (req.body?.name !== undefined) update.name = stringValue(req.body.name);
    if (req.body?.status !== undefined) {
      update.status = req.body.status === "suspended" ? "suspended" : "active";
    }
    if (req.body?.planSlug !== undefined) {
      update.planSlug = getPlanDefinition(stringValue(req.body.planSlug)).slug;
    }
    if (req.body?.enabledFeatures !== undefined) {
      update.enabledFeatures = normalizeFeatures(req.body.enabledFeatures);
    }
    if (req.body?.disabledFeatures !== undefined) {
      update.disabledFeatures = normalizeFeatures(req.body.disabledFeatures);
    }

    if (update.name === "") {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    const organization = await Organization.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    res.json({ organization: serializeOrganization(organization.toObject()) });
  } catch (err) {
    console.error("Error updating admin organization:", err);
    res.status(500).json({ error: "Failed to update organization" });
  }
}

export async function inviteAdminOrganizationMember(req: Request, res: Response): Promise<void> {
  try {
    const id = stringValue(req.params.id);
    const email = stringValue(req.body?.email).toLowerCase();
    const role = normalizeRole(req.body?.role);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }

    const organization = await Organization.findById(id);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const invitation = await createInvitation({
      organization,
      email,
      role,
      inviter: (req as AuthenticatedRequest).user,
    });

    res.status(201).json({ invitation: publicInvitation(invitation) });
  } catch (err) {
    console.error("Error inviting admin organization member:", err);
    res.status(500).json({ error: "Failed to invite organization member" });
  }
}
