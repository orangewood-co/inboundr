import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenRouter({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

export type EmailTriageCategory = "rfq" | "support" | "other";

const triageSchema = z.object({
  category: z.enum(["rfq", "support", "other"]),
  reason: z.string(),
});

/**
 * Routes mail on an inbox that serves both Quotations and Support: purchase
 * enquiries go to RFQ extraction, customer questions become support tickets,
 * and everything else stays in the Inbox untouched.
 */
export async function triageEmail(
  email: string,
  organizationName: string
): Promise<{ category: EmailTriageCategory; reason: string }> {
  const response = await model.withStructuredOutput(triageSchema).invoke([
    new SystemMessage(
      `You triage inbound email for ${organizationName || "a business"}, which both sells products and supports its customers.
Classify the email into exactly one category:
- rfq: the sender wants to buy. Requests for a quotation, price, availability, or lead time; purchase enquiries; tenders; product lists with quantities.
- support: an existing or prospective customer needs help from the business. Questions about an order, delivery, invoice, payment, product usage, installation, a fault, complaint, return, warranty, or their account; any customer question that needs a human reply and is not a request to buy.
- other: anything that does not need a customer-service reply. Newsletters, marketing, notifications, receipts, spam, vendors pitching or invoicing the business, job applications, internal or personal mail.
If an email mixes intents, pick the main one. Reply with the category and a one-sentence reason.`
    ),
    new HumanMessage(email),
  ]);
  return { category: response.category, reason: response.reason };
}
