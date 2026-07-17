import { RFQ } from "../models/rfq.model";
import { updateEmailStatus } from "./email.service";
import { classifyEmail } from "../agents/check_rfq";
import { generateRFQ } from "../agents/generate_rfq";
import { Organization } from "../models/organization.model";
import { hasEffectiveFeature } from "./entitlement.service";

interface ProcessEmailForRFQOptions {
  resetExisting?: boolean;
}

async function isQuotationProcessingEnabled(organizationId?: string): Promise<boolean> {
  if (!organizationId) return true;

  const organization = await Organization.findById(organizationId)
    .select("planSlug enabledFeatures disabledFeatures")
    .lean();

  return Boolean(organization && hasEffectiveFeature(organization, "rfq"));
}

export async function processEmailForRFQ(
  emailId: string,
  emailBody: string,
  messageId: string,
  userId: string,
  gmailAccountId: string,
  organizationId?: string,
  options: ProcessEmailForRFQOptions = {}
): Promise<void> {
  if (!(await isQuotationProcessingEnabled(organizationId))) {
    console.warn(
      `Skipping RFQ processing for email ${messageId}: Quotations feature is disabled`
    );
    return;
  }

  if (options.resetExisting) {
    await RFQ.deleteMany({
      emailId,
      userId,
      ...(organizationId ? { organizationId } : {}),
    });
  }

  await updateEmailStatus(messageId, "processing", undefined, gmailAccountId);

  try {
    const { isRFQemail, reason } = await classifyEmail(emailBody);

    const rfqDoc = await RFQ.create({
      userId,
      ...(organizationId ? { organizationId } : {}),
      gmailAccountId,
      emailId,
      isRFQ: isRFQemail,
      reason,
      isProcessed: !isRFQemail,
    });

    if (!isRFQemail) {
      await updateEmailStatus(messageId, "processed", undefined, gmailAccountId);
      console.log(`Email ${messageId} classified as non-RFQ: ${reason}`);
      return;
    }

    console.log(`Email ${messageId} classified as RFQ: ${reason}`);

    const organization = await Organization.findById(organizationId)
      .select("name description")
      .lean();

    const currentOrganizationContext = {
      name: organization?.name ?? "",
      description: organization?.description ?? "",
      searchInstructions: "",
    };

    const { customer, queryProducts, searchResults } =
      await generateRFQ(currentOrganizationContext, emailBody, organizationId);

    await RFQ.updateOne(
      { _id: rfqDoc._id },
      {
        $set: {
          customer,
          queryProducts,
          searchResults,
          isProcessed: true,
        },
      }
    );

    await updateEmailStatus(messageId, "processed", undefined, gmailAccountId);
    console.log(
      `RFQ processed for email ${messageId}: ${queryProducts.length} products found`
    );
  } catch (err: any) {
    console.error(`RFQ processing failed for email ${messageId}:`, err);

    await RFQ.updateOne(
      { emailId, ...(organizationId ? { organizationId } : {}) },
      {
        $set: {
          isProcessed: true,
          errorMessage: err.message || "Unknown error",
        },
      }
    );

    await updateEmailStatus(messageId, "failed", err.message, gmailAccountId);
  }
}
