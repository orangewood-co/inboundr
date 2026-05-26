import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { Organization } from "../models/organization.model";

async function main(): Promise<void> {
  await connectDB();

  try {
    const result = await Organization.updateMany(
      {
        $or: [
          { planSlug: { $exists: false } },
          { planSlug: null },
          { planSlug: "" },
        ],
      },
      {
        $set: {
          planSlug: "all_features",
          enabledFeatures: [],
          disabledFeatures: [],
          status: "active",
        },
      }
    );

    console.log("Organization entitlement backfill complete", {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Organization entitlement backfill failed:", err);
  process.exit(1);
});
