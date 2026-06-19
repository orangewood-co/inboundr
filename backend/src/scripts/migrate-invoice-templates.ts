import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { DEFAULT_INVOICE_TEMPLATE, Invoice } from "../models/invoice.model";
import { Organization } from "../models/organization.model";

// Maps legacy template names to the current template library. Mirrors
// normalizeInvoiceTemplateId() so migrated rows match what the renderer expects.
const LEGACY_MAP: Record<string, string> = {
  professional: "standard",
  modern: "standard",
  compact: "minimal",
};

async function main(): Promise<void> {
  await connectDB();

  try {
    let migratedInvoices = 0;
    for (const [legacy, target] of Object.entries(LEGACY_MAP)) {
      // Legacy values fall outside the strict template union, so the filter is
      // intentionally untyped here.
      const result = await Invoice.updateMany({ template: legacy } as Record<string, unknown>, {
        $set: { template: target },
      });
      migratedInvoices += result.modifiedCount ?? 0;
    }

    // Any invoice with a missing or otherwise unknown template falls back to the
    // global default so the enum stays valid on the next save.
    const validIds = ["minimal", "classic", "standard"];
    const fallbackResult = await Invoice.updateMany(
      { template: { $nin: validIds } } as Record<string, unknown>,
      { $set: { template: DEFAULT_INVOICE_TEMPLATE } }
    );

    const orgResult = await Organization.updateMany(
      { "preferences.defaultInvoiceTemplate": { $exists: false } },
      { $set: { "preferences.defaultInvoiceTemplate": DEFAULT_INVOICE_TEMPLATE } }
    );

    console.log("Invoice template migration complete", {
      migratedInvoices,
      fallbackInvoices: fallbackResult.modifiedCount ?? 0,
      organizationsDefaulted: orgResult.modifiedCount ?? 0,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Invoice template migration failed:", err);
  process.exit(1);
});
