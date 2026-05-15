import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { OrganizationMember } from "../models/organization-member.model";
import { Organization } from "../models/organization.model";

async function main(): Promise<void> {
  await connectDB();

  try {
    const organizations = await Organization.find().lean();
    let insertedOwners = 0;

    for (const organization of organizations) {
      const result = await OrganizationMember.updateOne(
        { organizationId: organization._id, userId: organization.ownerUserId },
        { $setOnInsert: { role: "owner" } },
        { upsert: true }
      );

      if (result.upsertedCount) insertedOwners += 1;
    }

    console.log("Organization member backfill complete", {
      organizations: organizations.length,
      insertedOwners,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Organization member backfill failed:", err);
  process.exit(1);
});
