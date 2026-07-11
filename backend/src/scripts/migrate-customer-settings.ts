import { connectDB } from "../config/database.config";
import {
  CustomerSettings,
  LEGACY_SPECIAL_DISCOUNT_FIELD,
} from "../models/customer-settings.model";
import { Organization } from "../models/organization.model";

async function migrateCustomerSettings() {
  await connectDB();

  const organizations = await Organization.find({}).select("_id").lean();
  let created = 0;
  let updated = 0;

  for (const organization of organizations) {
    const result = await CustomerSettings.updateOne(
      { organizationId: organization._id },
      {
        $setOnInsert: {
          organizationId: organization._id,
          fieldDefinitions: [LEGACY_SPECIAL_DISCOUNT_FIELD],
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created++;
      continue;
    }

    const addResult = await CustomerSettings.updateOne(
      {
        organizationId: organization._id,
        "fieldDefinitions.id": { $ne: LEGACY_SPECIAL_DISCOUNT_FIELD.id },
      },
      { $push: { fieldDefinitions: LEGACY_SPECIAL_DISCOUNT_FIELD } }
    );
    updated += addResult.modifiedCount;
  }

  console.log(
    `Customer settings migration complete: ${created} created, ${updated} updated`
  );
  process.exit(0);
}

migrateCustomerSettings().catch((error) => {
  console.error("Customer settings migration failed:", error);
  process.exit(1);
});
