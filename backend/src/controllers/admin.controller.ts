import type { Request, Response } from "express";
import crypto from "node:crypto";
import { createElement } from "react";
import mongoose from "mongoose";
import { OrganizationInvitationEmail } from "../emails/organization-invitation";
import { frontendOrigin } from "../config/origins.config";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { isPlatformAdmin } from "../middleware/auth.middleware";
import { emitDomainEvent } from "../events/domain-events";
import { auth } from "../lib/auth";
import { sendEmail } from "../lib/email";
import { OrganizationInvitation } from "../models/organization-invitation.model";
import {
  OrganizationMember,
  type OrganizationRole,
} from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import { ensureNotificationRecipient } from "../services/notification.service";
import {
  addAdminMessage,
  getFeedbackForAdmin,
  listFeedbackForAdmin,
  normalizeFeedbackStatus,
  normalizeFeedbackType,
  updateFeedbackStatus,
} from "../services/feedback.service";
import {
  FEATURE_CATALOG,
  PLAN_DEFINITIONS,
  getEffectiveFeatures,
  getPlanDefinition,
  normalizeFeatures,
  serializeEntitlements,
} from "../services/entitlement.service";
import { unlinkGmailAccountsForOrganization } from "../services/gmail-watcher.service";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeRole(value: unknown): OrganizationRole {
  return value === "owner" || value === "admin" ? value : "member";
}

function normalizeMoveRole(value: unknown): Exclude<OrganizationRole, "owner"> {
  return value === "admin" ? "admin" : "member";
}

function httpError(message: string, statusCode: number): Error {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

function authUserId(user: any): string {
  return String(user?.id ?? user?._id ?? "");
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

function serializeMember(member: any, user?: any) {
  return {
    _id: member._id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: member.role,
    user: user
      ? { id: user.id, name: user.name ?? "", email: user.email ?? "" }
      : null,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function serializeUserMembership(member: any, organization?: any) {
  return {
    _id: member._id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    organization: organization
      ? {
          _id: organization._id,
          name: organization.name,
          status: organization.status ?? "active",
          ownerUserId: organization.ownerUserId,
        }
      : null,
  };
}

function serializeAdminUser(user: any, memberships: any[]) {
  const id = authUserId(user);
  return {
    id,
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
    emailVerified: user.emailVerified ?? null,
    lastSignInAt: user.lastSignInAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    memberships,
  };
}

async function getUsersByIds(userIds: string[]) {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) return new Map<string, any>();

  const objectIds = userIds
    .filter((userId) => mongoose.Types.ObjectId.isValid(userId))
    .map((userId) => new mongoose.Types.ObjectId(userId));

  const users = await db
    .collection("user")
    .find({
      $or: [
        { id: { $in: userIds } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();

  const map = new Map<string, any>();
  for (const user of users) {
    map.set(user.id as string, user);
    map.set(String(user._id), user);
  }
  return map;
}

async function getUsersByEmails(emails: string[]) {
  const db = mongoose.connection.db;
  const normalizedEmails = emails.map((email) => email.toLowerCase()).filter(Boolean);
  if (!db || normalizedEmails.length === 0) return new Map<string, any>();

  const users = await db
    .collection("user")
    .find({ email: { $in: normalizedEmails } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();

  return new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
}

async function getUserById(userId: string) {
  const db = mongoose.connection.db;
  if (!db) return null;

  const objectIds = mongoose.Types.ObjectId.isValid(userId)
    ? [new mongoose.Types.ObjectId(userId)]
    : [];

  return db.collection("user").findOne({
    $or: [
      { id: userId },
      ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
    ],
  });
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
  const existingMember = await OrganizationMember.findOne({
    organizationId: organization._id,
    userId: email,
  }).lean();
  if (existingMember) {
    throw new Error("User is already a member of this organization");
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
    invitedByUserId: inviter.id,
    invitedByName: inviter.name ?? "",
    invitedByEmail: inviter.email ?? "",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

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
    isPro: Boolean(organization.isPro),
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
    const [memberCounts, pendingInviteCounts] = await Promise.all([
      OrganizationMember.aggregate([
        { $match: { organizationId: { $in: orgIds } } },
        { $group: { _id: "$organizationId", count: { $sum: 1 } } },
      ]),
      OrganizationInvitation.aggregate([
        { $match: { organizationId: { $in: orgIds }, status: "pending" } },
        { $group: { _id: "$organizationId", count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(memberCounts.map((row) => [row._id.toString(), row.count]));
    const inviteCountMap = new Map(pendingInviteCounts.map((row) => [row._id.toString(), row.count]));
    const users = await getUsersByIds(organizations.map((org) => org.ownerUserId));
    const pendingOwnerCount = organizations.filter((org) => org.ownerUserId.startsWith("pending-owner:")).length;

    res.json({
      summary: {
        total: organizations.length,
        active: organizations.filter((org) => (org.status ?? "active") === "active").length,
        suspended: organizations.filter((org) => org.status === "suspended").length,
        pendingOwner: pendingOwnerCount,
        pendingInvites: pendingInviteCounts.reduce((sum, row) => sum + row.count, 0),
      },
      organizations: organizations.map((organization) =>
        ({
          ...serializeOrganization(
          organization,
          users.get(organization.ownerUserId),
          countMap.get(organization._id.toString()) ?? 0
          ),
          pendingInviteCount: inviteCountMap.get(organization._id.toString()) ?? 0,
        })
      ),
    });
  } catch (err) {
    console.error("Error listing admin organizations:", err);
    res.status(500).json({ error: "Failed to list organizations" });
  }
}

export async function listAdminUsers(req: Request, res: Response): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({ error: "Database is not available" });
      return;
    }

    const q = stringValue(req.query.q).toLowerCase();
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "10"), 10) || 10));
    const skip = (page - 1) * limit;
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = q
      ? {
          $or: [
            { name: { $regex: escapedQuery, $options: "i" } },
            { email: { $regex: escapedQuery, $options: "i" } },
            { id: { $regex: escapedQuery, $options: "i" } },
          ],
        }
      : {};

    const [users, total, totalUsers] = await Promise.all([
      db
        .collection("user")
        .find(filter)
        .project({
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          emailVerified: 1,
          lastSignInAt: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("user").countDocuments(filter),
      db.collection("user").countDocuments({}),
    ]);

    const userIds = users.map(authUserId).filter(Boolean);
    const memberships = await OrganizationMember.find({ userId: { $in: userIds } })
      .sort({ createdAt: 1 })
      .lean();
    const organizationIds = [...new Set(memberships.map((membership) => String(membership.organizationId)))];
    const organizations = await Organization.find({ _id: { $in: organizationIds } }).lean();
    const organizationById = new Map(organizations.map((organization) => [String(organization._id), organization]));
    const membershipsByUserId = new Map<string, any[]>();

    for (const membership of memberships) {
      const list = membershipsByUserId.get(membership.userId) ?? [];
      list.push(serializeUserMembership(membership, organizationById.get(String(membership.organizationId))));
      membershipsByUserId.set(membership.userId, list);
    }

    const usersWithMemberships = await OrganizationMember.distinct("userId");

    res.json({
      users: users.map((user) => serializeAdminUser(user, membershipsByUserId.get(authUserId(user)) ?? [])),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        total: totalUsers,
        matching: total,
        withMemberships: usersWithMemberships.length,
        withoutMemberships: Math.max(0, totalUsers - usersWithMemberships.length),
      },
    });
  } catch (err) {
    console.error("Error listing admin users:", err);
    res.status(500).json({ error: "Failed to list users" });
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

    const members = await OrganizationMember.find({ organizationId: organization._id }).sort({ createdAt: 1 }).lean();
    const userIds = [...new Set([organization.ownerUserId, ...members.map((member) => member.userId)])];
    const [invitations, users] = await Promise.all([
      OrganizationInvitation.find({ organizationId: organization._id, status: "pending" }).sort({ createdAt: -1 }).lean(),
      getUsersByIds(userIds),
    ]);

    res.json({
      organization: {
        ...serializeOrganization(organization, users.get(organization.ownerUserId), members.length),
        pendingInviteCount: invitations.length,
      },
      members: members.map((member) => serializeMember(member, users.get(member.userId))),
      invitations: invitations.map(publicInvitation),
      summary: {
        members: members.length,
        admins: members.filter((member) => member.role === "admin").length,
        owners: members.filter((member) => member.role === "owner").length,
        pendingInvites: invitations.length,
      },
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
    if (req.body?.isPro !== undefined) {
      update.isPro = Boolean(req.body.isPro);
    }

    if (update.name === "") {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    const beforeOrganization = await Organization.findById(id).lean();
    if (!beforeOrganization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const hadRFQAccess = getEffectiveFeatures(beforeOrganization).includes("rfq");
    const organization = await Organization.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const hasRFQAccess = getEffectiveFeatures(organization).includes("rfq");
    let quotationsCleanup:
      | { triggered: boolean; accounts: Awaited<ReturnType<typeof unlinkGmailAccountsForOrganization>>; error?: string }
      | undefined;

    if (hadRFQAccess && !hasRFQAccess) {
      try {
        quotationsCleanup = {
          triggered: true,
          accounts: await unlinkGmailAccountsForOrganization(
            organization._id.toString(),
            "Quotations feature disabled"
          ),
        };
      } catch (err: any) {
        console.error("Failed to clean up Gmail accounts after disabling Quotations:", err);
        quotationsCleanup = {
          triggered: true,
          accounts: [],
          error: err?.message || "Failed to clean up Gmail accounts",
        };
      }
    }

    res.json({
      organization: serializeOrganization(organization.toObject()),
      ...(quotationsCleanup ? { quotationsCleanup } : {}),
    });
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

    const user = (await getUsersByEmails([email])).get(email);
    const existingMember = user
      ? await OrganizationMember.findOne({ organizationId: organization._id, userId: user.id }).lean()
      : null;
    if (existingMember) {
      res.status(409).json({ error: "User is already a member of this organization" });
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

export async function createAdminOrganizationUser(req: Request, res: Response): Promise<void> {
  try {
    const id = stringValue(req.params.id);
    const name = stringValue(req.body?.name);
    const email = stringValue(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const role = normalizeRole(req.body?.role);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    const organization = await Organization.findById(id);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // An owner can only be created while the org still has the pending-owner
    // placeholder; an existing owner must be replaced via transfer ownership.
    const ownerSlotAvailable = organization.ownerUserId.startsWith("pending-owner:");
    if (role === "owner" && !ownerSlotAvailable) {
      res.status(409).json({
        error: "This organization already has an owner. Transfer ownership instead.",
      });
      return;
    }

    const ctx = await auth.$context;

    const minPasswordLength = ctx.password.config.minPasswordLength;
    if (password.length < minPasswordLength) {
      res.status(400).json({ error: `Password must be at least ${minPasswordLength} characters` });
      return;
    }

    const existing = await ctx.internalAdapter.findUserByEmail(email);
    if (existing) {
      res.status(409).json({
        error: "An account with this email already exists. Use Add to organization instead.",
      });
      return;
    }

    // Create a pre-verified account without triggering the verification email,
    // mirroring Better Auth's own signup flow (emailVerified set to true).
    const hashedPassword = await ctx.password.hash(password);
    const createdUser = await ctx.internalAdapter.createUser({
      name,
      email,
      emailVerified: true,
    });
    await ctx.internalAdapter.linkAccount({
      userId: createdUser.id,
      providerId: "credential",
      accountId: createdUser.id,
      password: hashedPassword,
    });

    let member;
    try {
      member = await OrganizationMember.create({
        organizationId: organization._id,
        userId: createdUser.id,
        role,
      });
    } catch (membershipErr: any) {
      console.error("Error attaching admin-created user to organization:", membershipErr);
      res.status(membershipErr?.code === 11000 ? 409 : 500).json({
        error:
          "The account was created but could not be added to the organization. Add the user to the organization manually.",
      });
      return;
    }

    if (role === "owner") {
      organization.ownerUserId = createdUser.id;
      await organization.save();
    }

    res.status(201).json({
      user: serializeAdminUser(createdUser, [
        serializeUserMembership(member.toObject(), organization),
      ]),
      member: serializeMember(member.toObject(), createdUser),
    });
  } catch (err) {
    console.error("Error creating admin organization user:", err);
    res.status(500).json({ error: "Failed to create user account" });
  }
}

export async function addAdminUserMembership(req: Request, res: Response): Promise<void> {
  try {
    const userId = stringValue(req.params.userId);
    const organizationId = stringValue(req.body?.organizationId);
    const role = normalizeMoveRole(req.body?.role);

    if (!userId) {
      res.status(400).json({ error: "User id is required" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }

    const [user, organization] = await Promise.all([
      getUserById(userId),
      Organization.findById(organizationId).lean(),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const existingMember = await OrganizationMember.findOne({
      organizationId,
      userId: authUserId(user),
    }).lean();
    if (existingMember) {
      res.status(409).json({ error: "User is already a member of this organization" });
      return;
    }

    const member = await OrganizationMember.create({
      organizationId,
      userId: authUserId(user),
      role,
    });

    res.status(201).json({
      member: serializeUserMembership(member.toObject(), organization),
    });
  } catch (err: any) {
    console.error("Error adding admin user membership:", err);
    res.status(err?.code === 11000 ? 409 : 500).json({
      error: err?.code === 11000 ? "User is already a member of this organization" : "Failed to add user membership",
    });
  }
}

export async function sendAdminSampleNotification(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = stringValue(req.body?.organizationId);
    const recipientUserId = stringValue(req.body?.recipientUserId);
    const title = stringValue(req.body?.title) || "Sample Notification";
    const body = stringValue(req.body?.body) || "This is a sample in-app notification from Super Admin.";
    const actionUrl = stringValue(req.body?.actionUrl) || null;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ error: "Invalid organization id" });
      return;
    }
    if (!recipientUserId) {
      res.status(400).json({ error: "Recipient user id is required" });
      return;
    }

    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    await ensureNotificationRecipient(organizationId, recipientUserId);
    await emitDomainEvent("admin.notification_sample.requested", {
      organizationId,
      recipientUserId,
      title,
      body,
      actionUrl,
      actorUserId: authReq.user.id,
    });

    res.status(201).json({ message: "Sample notification sent" });
  } catch (err: any) {
    console.error("Error sending sample notification:", err);
    res.status(err?.statusCode || 500).json({
      error: err?.statusCode ? err.message : "Failed to send sample notification",
    });
  }
}

export async function updateAdminOrganizationMember(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.params.id);
    const memberId = stringValue(req.params.memberId);
    const role = normalizeRole(req.body?.role);

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      res.status(400).json({ error: "Invalid organization or member id" });
      return;
    }

    const member = await OrganizationMember.findOne({ _id: memberId, organizationId });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (member.role === "owner" && role !== "owner") {
      res.status(400).json({ error: "Transfer ownership before changing the owner role" });
      return;
    }

    member.role = role;
    await member.save();
    res.json({ member: serializeMember(member.toObject()) });
  } catch (err) {
    console.error("Error updating admin organization member:", err);
    res.status(500).json({ error: "Failed to update member" });
  }
}

export async function removeAdminOrganizationMember(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.params.id);
    const memberId = stringValue(req.params.memberId);

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      res.status(400).json({ error: "Invalid organization or member id" });
      return;
    }

    const member = await OrganizationMember.findOne({ _id: memberId, organizationId });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const organization = await Organization.findById(organizationId).lean();
    if (organization?.ownerUserId === member.userId) {
      res.status(400).json({ error: "Transfer ownership before removing the organization owner" });
      return;
    }

    await member.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error("Error removing admin organization member:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
}

export async function moveAdminOrganizationMember(req: Request, res: Response): Promise<void> {
  const mongoSession = await mongoose.startSession();

  try {
    const sourceOrganizationId = stringValue(req.params.id);
    const memberId = stringValue(req.params.memberId);
    const targetOrganizationId = stringValue(req.body?.targetOrganizationId);
    const role = normalizeMoveRole(req.body?.role);

    if (
      !mongoose.Types.ObjectId.isValid(sourceOrganizationId) ||
      !mongoose.Types.ObjectId.isValid(memberId) ||
      !mongoose.Types.ObjectId.isValid(targetOrganizationId)
    ) {
      res.status(400).json({ error: "Invalid organization or member id" });
      return;
    }

    if (sourceOrganizationId === targetOrganizationId) {
      res.status(400).json({ error: "Choose a different target organization" });
      return;
    }

    let movedUserId = "";
    let movedMember: any = null;
    let movedOrganization: any = null;

    await mongoSession.withTransaction(async () => {
      const [sourceOrganization, targetOrganization, member] = await Promise.all([
        Organization.findById(sourceOrganizationId).session(mongoSession),
        Organization.findById(targetOrganizationId).session(mongoSession),
        OrganizationMember.findOne({ _id: memberId, organizationId: sourceOrganizationId }).session(mongoSession),
      ]);

      if (!sourceOrganization || !targetOrganization) {
        throw httpError("Organization not found", 404);
      }
      if (!member) {
        throw httpError("Member not found", 404);
      }
      if (sourceOrganization.ownerUserId === member.userId) {
        throw httpError("Transfer ownership before moving this user", 400);
      }

      const existingTargetMember = await OrganizationMember.findOne({
        organizationId: targetOrganization._id,
        userId: member.userId,
      }).session(mongoSession);

      if (existingTargetMember) {
        throw httpError("User is already a member of the target organization", 409);
      }

      movedUserId = member.userId;
      movedOrganization = targetOrganization.toObject();
      await member.deleteOne({ session: mongoSession });
      const createdMembers = await OrganizationMember.create(
        [
          {
            organizationId: targetOrganization._id,
            userId: movedUserId,
            role,
          },
        ],
        { session: mongoSession }
      );
      const createdMember = createdMembers[0];
      if (!createdMember) throw httpError("Failed to create target membership", 500);
      movedMember = createdMember.toObject();
    });

    res.json({
      ok: true,
      userId: movedUserId,
      targetOrganizationId,
      role,
      member: movedMember ? serializeUserMembership(movedMember, movedOrganization) : null,
    });
  } catch (err: any) {
    console.error("Error moving admin organization member:", err);
    const statusCode = err?.statusCode || (err?.code === 11000 ? 409 : 500);
    res.status(statusCode).json({
      error: statusCode === 500 ? "Failed to move member" : err.message || "Failed to move member",
    });
  } finally {
    await mongoSession.endSession();
  }
}

export async function transferAdminOrganizationOwner(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.params.id);
    const memberId = stringValue(req.params.memberId);

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      res.status(400).json({ error: "Invalid organization or member id" });
      return;
    }

    const [organization, newOwner] = await Promise.all([
      Organization.findById(organizationId),
      OrganizationMember.findOne({ _id: memberId, organizationId }),
    ]);

    if (!organization || !newOwner) {
      res.status(404).json({ error: "Organization or member not found" });
      return;
    }

    await OrganizationMember.updateMany(
      { organizationId, role: "owner" },
      { $set: { role: "admin" } }
    );
    newOwner.role = "owner";
    await newOwner.save();
    organization.ownerUserId = newOwner.userId;
    await organization.save();

    res.json({ organization: serializeOrganization(organization.toObject()), member: serializeMember(newOwner.toObject()) });
  } catch (err) {
    console.error("Error transferring admin organization owner:", err);
    res.status(500).json({ error: "Failed to transfer owner" });
  }
}

export async function listAdminFeedback(req: Request, res: Response): Promise<void> {
  try {
    const { feedback, unreadCount } = await listFeedbackForAdmin({
      type: normalizeFeedbackType(req.query.type),
      status: normalizeFeedbackStatus(req.query.status),
      unreadOnly: stringValue(req.query.unread) === "true",
    });
    res.json({ feedback, unreadCount });
  } catch (err) {
    console.error("Error listing admin feedback:", err);
    res.status(500).json({ error: "Failed to list feedback" });
  }
}

export async function getAdminFeedback(req: Request, res: Response): Promise<void> {
  try {
    const feedback = await getFeedbackForAdmin(stringValue(req.params.id), {
      markRead: true,
    });
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.json({ feedback });
  } catch (err) {
    console.error("Error fetching admin feedback:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
}

export async function replyAdminFeedback(req: Request, res: Response): Promise<void> {
  try {
    const message = stringValue(req.body?.message);
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (message.length > 5000) {
      res.status(400).json({ error: "Message is too long" });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const feedback = await addAdminMessage({
      feedbackId: stringValue(req.params.id),
      actor: { id: authReq.user.id, name: authReq.user.name, email: authReq.user.email },
      body: message,
    });
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.status(201).json({ feedback });
  } catch (err) {
    console.error("Error replying to admin feedback:", err);
    res.status(500).json({ error: "Failed to send reply" });
  }
}

export async function updateAdminFeedback(req: Request, res: Response): Promise<void> {
  try {
    const status = normalizeFeedbackStatus(req.body?.status);
    if (!status) {
      res.status(400).json({ error: "A valid status is required" });
      return;
    }

    const feedback = await updateFeedbackStatus(stringValue(req.params.id), status);
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.json({ feedback });
  } catch (err) {
    console.error("Error updating admin feedback:", err);
    res.status(500).json({ error: "Failed to update feedback" });
  }
}

export async function cancelAdminOrganizationInvitation(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = stringValue(req.params.id);
    const invitationId = stringValue(req.params.invitationId);

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(invitationId)) {
      res.status(400).json({ error: "Invalid organization or invitation id" });
      return;
    }

    const invitation = await OrganizationInvitation.findOneAndUpdate(
      { _id: invitationId, organizationId, status: "pending" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
      { new: true }
    );

    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    res.json({ invitation: publicInvitation(invitation) });
  } catch (err) {
    console.error("Error cancelling admin organization invitation:", err);
    res.status(500).json({ error: "Failed to cancel invitation" });
  }
}
