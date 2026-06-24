import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { OrganizationMember } from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import { ensureDefaultAccessGroups } from "../services/access-group.service";

async function main(): Promise<void> {
  await connectDB();

  try {
    const organizations = await Organization.find().lean();
    let updatedMembers = 0;
    let insertedOwners = 0;

    for (const organization of organizations) {
      const defaults = await ensureDefaultAccessGroups(organization._id);

      if (organization.ownerUserId && !organization.ownerUserId.startsWith("pending-owner:")) {
        const ownerResult = await OrganizationMember.updateOne(
          { organizationId: organization._id, userId: organization.ownerUserId },
          {
            $setOnInsert: { role: "owner" },
            $addToSet: { accessGroupIds: defaults.admin._id },
          },
          { upsert: true }
        );
        if (ownerResult.upsertedCount) insertedOwners += 1;
      }

      const members = await OrganizationMember.find({
        organizationId: organization._id,
      });

      for (const member of members) {
        const defaultGroup =
          member.role === "owner" || member.role === "admin"
            ? defaults.admin
            : defaults.members;
        const hasDefaultGroup = member.accessGroupIds.some((groupId) =>
          groupId.equals(defaultGroup._id)
        );

        if (!hasDefaultGroup) {
          member.accessGroupIds.push(defaultGroup._id);
          await member.save();
          updatedMembers += 1;
        }
      }
    }

    console.log("Access group backfill complete", {
      organizations: organizations.length,
      insertedOwners,
      updatedMembers,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Access group backfill failed:", err);
  process.exit(1);
});
