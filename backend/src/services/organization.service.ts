import mongoose from "mongoose";
import { Organization, type IOrganization } from "../models/organization.model";
import {
  OrganizationMember,
  type IOrganizationMember,
} from "../models/organization-member.model";
import { OrganizationInvitation } from "../models/organization-invitation.model";
import {
  defaultAccessGroupIdsForRole,
  ensureDefaultAccessGroups,
} from "./access-group.service";

export interface OrganizationUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

function isDuplicateOwnerError(err: unknown, userId: string): boolean {
  const error = err as { code?: number; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return (
    error.code === 11000 &&
    error.keyPattern?.ownerUserId === 1 &&
    error.keyValue?.ownerUserId === userId
  );
}

async function ensureOwnerMembership(organization: IOrganization, userId: string): Promise<void> {
  const defaultGroups = await ensureDefaultAccessGroups(organization._id);
  await OrganizationMember.updateOne(
    { organizationId: organization._id, userId },
    {
      $setOnInsert: { role: "owner" },
      $addToSet: { accessGroupIds: defaultGroups.admin._id },
    },
    { upsert: true }
  );
}

async function ensureInvitationMembership(
  invitation: {
    organizationId: mongoose.Types.ObjectId;
    role: IOrganizationMember["role"];
    accessGroupIds?: mongoose.Types.ObjectId[];
  },
  organization: IOrganization,
  user: OrganizationUser
): Promise<void> {
  const accessGroupIds =
    invitation.accessGroupIds && invitation.accessGroupIds.length > 0
      ? invitation.accessGroupIds
      : await defaultAccessGroupIdsForRole(invitation.organizationId, invitation.role);
  const memberRole: IOrganizationMember["role"] =
    invitation.role === "owner" ? "owner" : "member";

  await OrganizationMember.updateOne(
    { organizationId: invitation.organizationId, userId: user.id },
    {
      $setOnInsert: { role: memberRole },
      $addToSet: { accessGroupIds: { $each: accessGroupIds } },
    },
    { upsert: true }
  );

  if (invitation.role === "owner" && organization.ownerUserId.startsWith("pending-owner:")) {
    organization.ownerUserId = user.id;
    await organization.save();
  }
}

async function createPersonalOrganizationForUser(user: OrganizationUser): Promise<IOrganization> {
  try {
    const organization = await Organization.create({
      ownerUserId: user.id,
      name: user.name ? `${user.name}'s Organization` : "My Organization",
      defaultContact: {
        name: user.name ?? "",
        email: user.email ?? "",
        phoneNumber: "",
      },
    });
    await ensureDefaultAccessGroups(organization._id);
    return organization;
  } catch (err) {
    if (!isDuplicateOwnerError(err, user.id)) throw err;

    const organization = await Organization.findOne({ ownerUserId: user.id });
    if (organization) return organization;
    throw err;
  }
}

async function claimPendingInvitationForUser(
  user: OrganizationUser
): Promise<IOrganization | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const pendingInvitationQuery = {
    email,
    status: "pending" as const,
    expiresAt: { $gt: new Date() },
  };
  const invitation =
    (await OrganizationInvitation.findOne({
      ...pendingInvitationQuery,
      role: "owner",
    }).sort({ createdAt: 1 })) ??
    (await OrganizationInvitation.findOne(pendingInvitationQuery).sort({
      createdAt: 1,
    }));
  if (!invitation) return null;

  const organization = await Organization.findById(invitation.organizationId);
  if (!organization) return null;

  await ensureInvitationMembership(invitation, organization, user);

  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  await invitation.save();

  return organization;
}

async function restoreAcceptedInvitationForUser(
  user: OrganizationUser
): Promise<IOrganization | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const invitation = await OrganizationInvitation.findOne({
    email,
    status: "accepted",
  }).sort({ acceptedAt: -1, updatedAt: -1 });
  if (!invitation) return null;

  const organization = await Organization.findById(invitation.organizationId);
  if (!organization) return null;

  await ensureInvitationMembership(invitation, organization, user);
  return organization;
}

export async function getOrCreateOrganizationForUser(
  user: OrganizationUser
): Promise<IOrganization> {
  const invitedOrganization = await claimPendingInvitationForUser(user);
  if (invitedOrganization) return invitedOrganization;

  const restoredInvitationOrganization = await restoreAcceptedInvitationForUser(user);
  if (restoredInvitationOrganization) return restoredInvitationOrganization;

  const membership = await OrganizationMember.findOne({ userId: user.id }).sort({
    createdAt: 1,
  });
  if (membership) {
    const organization = await Organization.findById(membership.organizationId);
    if (organization) return organization;
  }

  const existingOwned = await Organization.findOne({ ownerUserId: user.id });
  if (existingOwned) {
    await ensureOwnerMembership(existingOwned, user.id);
    return existingOwned;
  }

  const organization = await createPersonalOrganizationForUser(user);
  await ensureOwnerMembership(organization, user.id);

  return organization;
}

export interface OrganizationContext {
  organization: IOrganization;
  membership: IOrganizationMember;
}

export async function getOrganizationContextForUser(
  user: OrganizationUser,
  requestedOrganizationId?: string | null
): Promise<OrganizationContext> {
  if (requestedOrganizationId && !mongoose.Types.ObjectId.isValid(requestedOrganizationId)) {
    throw new Error("Invalid organization id");
  }

  const organization = requestedOrganizationId
    ? await Organization.findById(requestedOrganizationId)
    : await getOrCreateOrganizationForUser(user);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const membership = await OrganizationMember.findOne({
    organizationId: organization._id,
    userId: user.id,
  });

  if (!membership) {
    throw new Error("Organization access denied");
  }

  return { organization, membership };
}
