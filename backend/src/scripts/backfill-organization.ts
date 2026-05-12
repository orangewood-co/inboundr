import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { Customer } from "../models/customer.model";
import { Email } from "../models/email.model";
import { GmailAccount } from "../models/gmail-account.model";
import { OrganizationMember } from "../models/organization-member.model";
import { Organization } from "../models/organization.model";
import { RFQ } from "../models/rfq.model";
import { RFQReply } from "../models/rfq-reply.model";

async function main(): Promise<void> {
  const ownerUserId = '69fae1326334cc3cb5a7ec3e';

  if (!ownerUserId) {
    throw new Error("TARGET_USER_ID is required");
  }

  await connectDB();

  try {
    const organization = await Organization.findOneAndUpdate(
      { ownerUserId },
      {
        $setOnInsert: {
          ownerUserId,
          name: process.env.ORGANIZATION_NAME || "My Organization",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const organizationId = organization._id;
    await OrganizationMember.updateOne(
      { organizationId, userId: ownerUserId },
      { $setOnInsert: { role: "owner" } },
      { upsert: true }
    );

    const missingOrganization = {
      $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
    };

    const [customers, gmailAccounts, emails, rfqs, replies] = await Promise.all([
      Customer.updateMany(missingOrganization, { $set: { organizationId } }),
      GmailAccount.updateMany(
        { userId: ownerUserId, ...missingOrganization },
        { $set: { organizationId } }
      ),
      Email.updateMany(
        { userId: ownerUserId, ...missingOrganization },
        { $set: { organizationId } }
      ),
      RFQ.updateMany(
        { userId: ownerUserId, ...missingOrganization },
        { $set: { organizationId } }
      ),
      RFQReply.updateMany(
        { userId: ownerUserId, ...missingOrganization },
        { $set: { organizationId } }
      ),
    ]);

    console.log("Organization backfill complete", {
      organizationId: organizationId.toString(),
      customers: customers.modifiedCount,
      gmailAccounts: gmailAccounts.modifiedCount,
      emails: emails.modifiedCount,
      rfqs: rfqs.modifiedCount,
      replies: replies.modifiedCount,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Organization backfill failed:", err);
  process.exit(1);
});
