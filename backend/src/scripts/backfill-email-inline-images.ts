import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { Email } from "../models/email.model";
import { GmailAccount, type IGmailAccount } from "../models/gmail-account.model";
import { getEmailById } from "../services/email.service";

/**
 * Re-parses, from Gmail, stored emails whose body embeds images through `cid:`
 * references, so those images move out of `attachments` into `inlineImages`.
 * Rows stored before inline images were tracked have no `inlineImages` field
 * and every processed row gets one, so a re-run only picks up what is left.
 *
 * Usage: bun src/scripts/backfill-email-inline-images.ts [--dry-run]
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  try {
    const emails = await Email.find({
      inlineImages: { $exists: false },
      messageId: { $type: "string" },
      "attachments.0": { $exists: true },
      bodyHtml: /cid:/i,
    })
      .select("_id gmailAccountId messageId")
      .lean();

    const accounts = new Map<string, IGmailAccount | null>();
    const stats = {
      scanned: emails.length,
      updated: 0,
      inlineImages: 0,
      missingAccount: 0,
      failed: 0,
    };

    for (const email of emails) {
      const accountKey = email.gmailAccountId.toString();
      if (!accounts.has(accountKey)) {
        accounts.set(accountKey, await GmailAccount.findById(email.gmailAccountId));
      }
      const account = accounts.get(accountKey);
      if (!account) {
        stats.missingAccount += 1;
        continue;
      }

      try {
        const parsed = await getEmailById(account, email.messageId);
        if (!dryRun) {
          await Email.updateOne(
            { _id: email._id },
            {
              $set: {
                attachments: parsed.attachments,
                inlineImages: parsed.inlineImages,
              },
            }
          );
        }
        stats.updated += 1;
        stats.inlineImages += parsed.inlineImages.length;
      } catch (err) {
        stats.failed += 1;
        console.error(`Failed to backfill inline images for email ${email._id}:`, err);
      }
    }

    console.log(
      dryRun ? "Inline image backfill dry run complete" : "Inline image backfill complete",
      stats
    );
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Inline image backfill failed:", err);
  process.exit(1);
});
