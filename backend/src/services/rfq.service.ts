import { RFQ } from "../models/rfq.model";
import { Email } from "../models/email.model";
import { updateEmailStatus } from "./email.service";
import {
  buildManualRFQProcessingInput,
  buildRFQThreadConversationInput,
} from "./rfq-input.service";
import { classifyEmail } from "../agents/check_rfq";
import { generateRFQ } from "../agents/generate_rfq";
import { Organization } from "../models/organization.model";
import { hasEffectiveFeature } from "./entitlement.service";
import { emitDomainEvent } from "../events/domain-events";

interface ProcessEmailForRFQOptions {
  resetExisting?: boolean;
  /** Gmail conversation id of the email, used to find an existing thread RFQ. */
  threadId?: string | null;
  /** Outcome of an upstream classifier (mixed-purpose inbox triage); skips the RFQ check. */
  classification?: { isRFQemail: boolean; reason: string };
}

async function isQuotationProcessingEnabled(organizationId?: string): Promise<boolean> {
  if (!organizationId) return true;

  const organization = await Organization.findById(organizationId)
    .select("planSlug enabledFeatures disabledFeatures")
    .lean();

  return Boolean(organization && hasEffectiveFeature(organization, "rfq"));
}

async function getOrganizationContext(organizationId?: string) {
  const organization = await Organization.findById(organizationId)
    .select("name description")
    .lean();

  return {
    name: organization?.name ?? "",
    description: organization?.description ?? "",
    searchInstructions: "",
  };
}

/**
 * A reply on a thread that already has an RFQ never spawns a new one. Instead
 * the whole conversation is re-extracted so the existing RFQ reflects the
 * latest agreed state (e.g. a quantity confirmed in a follow-up). A bare reply
 * like "Around 6?" would also misclassify as non-RFQ on its own, which is why
 * standalone classification is skipped entirely on this path.
 *
 * Only extracted request data is refreshed; a quote the user already drafted
 * or sent (workflowStatus, savedQuoteProducts, terms) is left untouched.
 */
async function updateRFQFromThreadReply(params: {
  rfqId: string;
  emailId: string;
  emailBody: string;
  messageId: string;
  gmailAccountId: string;
  threadId: string;
  organizationId?: string;
}): Promise<void> {
  const { rfqId, emailId, emailBody, messageId, gmailAccountId, threadId, organizationId } = params;

  await updateEmailStatus(messageId, "processing", undefined, gmailAccountId);

  try {
    const priorEmails = await Email.find({
      gmailAccountId,
      threadId,
      _id: { $ne: emailId },
      messageId: { $exists: true, $ne: null },
    })
      .select("from to date direction bodyText bodyHtml")
      .sort({ date: 1 })
      .lean();

    const conversation = buildRFQThreadConversationInput(priorEmails, emailBody);
    const organizationContext = await getOrganizationContext(organizationId);

    const { customer, queryProducts, searchResults } = await generateRFQ(
      organizationContext,
      conversation,
      organizationId
    );

    await RFQ.updateOne(
      { _id: rfqId },
      {
        $set: {
          customer,
          queryProducts,
          searchResults,
          isProcessed: true,
          latestEmailId: emailId,
          errorMessage: null,
        },
      }
    );

    await updateEmailStatus(messageId, "processed", undefined, gmailAccountId);
    console.log(
      `RFQ ${rfqId} updated from thread reply ${messageId}: ${queryProducts.length} products found`
    );
  } catch (err: any) {
    console.error(`RFQ thread update failed for email ${messageId}:`, err);
    // The existing RFQ still holds valid data from earlier messages, so only
    // the reply email is marked failed (which allows a manual reprocess).
    await updateEmailStatus(messageId, "failed", err.message, gmailAccountId);
  }
}

/**
 * One-off boot migration: RFQs created before thread-awareness carry no
 * threadId, so replies could not find them. Copies it from the source email.
 */
export async function backfillRFQThreadIds(): Promise<void> {
  const missing = await RFQ.find({
    $or: [{ threadId: null }, { threadId: { $exists: false } }],
    emailId: { $ne: null },
  })
    .select("emailId")
    .lean();
  if (missing.length === 0) return;

  const emails = await Email.find({ _id: { $in: missing.map((rfq) => rfq.emailId) } })
    .select("threadId")
    .lean();
  const threadIdByEmailId = new Map(
    emails.map((email) => [email._id.toString(), email.threadId])
  );

  const operations = missing.flatMap((rfq) => {
    if (!rfq.emailId) return [];
    const threadId = threadIdByEmailId.get(rfq.emailId.toString());
    if (!threadId) return [];
    return [
      {
        updateOne: {
          filter: { _id: rfq._id },
          update: { $set: { threadId } },
        },
      },
    ];
  });

  if (operations.length > 0) {
    await RFQ.bulkWrite(operations);
    console.log(`Backfilled threadId on ${operations.length} RFQs`);
  }
}

/**
 * Extraction for a manually created RFQ (pasted text and/or uploaded files).
 * Classification already happened synchronously at creation time, so only
 * extraction runs here. Runs in the background after the RFQ doc is created;
 * on retry the same doc is reprocessed from its stored manualInput.
 *
 * `prebuiltInput` lets the create endpoint reuse the extraction it already ran
 * for classification instead of downloading and parsing the files again.
 */
export async function processManualRFQ(
  rfqId: string,
  prebuiltInput?: string
): Promise<void> {
  const rfq = await RFQ.findById(rfqId).lean();
  if (!rfq || rfq.source !== "manual" || !rfq.manualInput) return;

  try {
    const input = prebuiltInput ?? (await buildManualRFQProcessingInput(rfq.manualInput));
    if (!input.trim()) {
      throw new Error("No processable text could be extracted from the submission");
    }

    const organizationId = rfq.organizationId?.toString();
    const organizationContext = await getOrganizationContext(organizationId);
    const { customer, queryProducts, searchResults } = await generateRFQ(
      organizationContext,
      input,
      organizationId
    );

    await RFQ.updateOne(
      { _id: rfq._id },
      {
        $set: {
          customer,
          queryProducts,
          searchResults,
          isProcessed: true,
          errorMessage: null,
        },
      }
    );

    console.log(
      `Manual RFQ ${rfqId} processed: ${queryProducts.length} products found`
    );

    if (organizationId) {
      void emitDomainEvent("rfq.identified", {
        rfqId,
        organizationId,
        userId: rfq.userId,
      });
    }
  } catch (err: any) {
    console.error(`Manual RFQ processing failed for ${rfqId}:`, err);
    await RFQ.updateOne(
      { _id: rfqId },
      {
        $set: {
          isProcessed: true,
          errorMessage: err.message || "Unknown error",
        },
      }
    );
  }
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

  const threadId = options.threadId ?? null;
  if (threadId) {
    const existingThreadRFQ = await RFQ.findOne({
      gmailAccountId,
      threadId,
      isRFQ: true,
      emailId: { $ne: emailId },
      ...(organizationId ? { organizationId } : {}),
    })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    if (existingThreadRFQ) {
      await updateRFQFromThreadReply({
        rfqId: existingThreadRFQ._id.toString(),
        emailId,
        emailBody,
        messageId,
        gmailAccountId,
        threadId,
        organizationId,
      });
      return;
    }
  }

  await updateEmailStatus(messageId, "processing", undefined, gmailAccountId);

  try {
    const { isRFQemail, reason } = options.classification ?? (await classifyEmail(emailBody));

    const rfqDoc = await RFQ.create({
      userId,
      ...(organizationId ? { organizationId } : {}),
      gmailAccountId,
      emailId,
      threadId,
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

    const currentOrganizationContext = await getOrganizationContext(organizationId);

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

    if (organizationId) {
      void emitDomainEvent("rfq.identified", {
        rfqId: rfqDoc._id.toString(),
        organizationId,
        userId,
      });
    }
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
