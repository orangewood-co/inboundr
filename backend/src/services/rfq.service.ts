import { RFQ } from "../models/rfq.model";
import { updateEmailStatus } from "./email.service";
import { classifyEmail } from "../agents/check_rfq";
import { generateRFQ } from "../agents/generate_rfq";

export async function processEmailForRFQ(
  emailId: string,
  emailBody: string,
  messageId: string,
  userId: string,
  gmailAccountId: string
): Promise<void> {
  await updateEmailStatus(messageId, "processing", undefined, gmailAccountId);

  try {
    const { isRFQemail, reason } = await classifyEmail(emailBody);

    const rfqDoc = await RFQ.create({
      userId,
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

    const { customer, queryProducts, searchResults } =
      await generateRFQ(emailBody);

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
      { emailId },
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
