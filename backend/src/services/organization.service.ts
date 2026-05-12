import mongoose from "mongoose";
import { Organization, type IOrganization } from "../models/organization.model";
import {
  OrganizationMember,
  type IOrganizationMember,
} from "../models/organization-member.model";

export interface OrganizationUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export async function getOrCreateOrganizationForUser(
  user: OrganizationUser
): Promise<IOrganization> {
  const membership = await OrganizationMember.findOne({ userId: user.id }).sort({
    createdAt: 1,
  });
  if (membership) {
    const organization = await Organization.findById(membership.organizationId);
    if (organization) return organization;
  }

  const existingOwned = await Organization.findOne({ ownerUserId: user.id });
  const organization = existingOwned ?? await Organization.create({
    ownerUserId: user.id,
    name: user.name ? `${user.name}'s Organization` : "My Organization",
    defaultContact: {
      name: user.name ?? "",
      email: user.email ?? "",
      phoneNumber: "",
    },
  });

  await OrganizationMember.updateOne(
    { organizationId: organization._id, userId: user.id },
    { $setOnInsert: { role: "owner" } },
    { upsert: true }
  );

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
