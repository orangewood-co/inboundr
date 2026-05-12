import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
});

const State = new StateSchema({
  input: z.string(),
  subject: z.string(),
  body: z.string(),
});

const quoteOutput = z.object({
  subject: z.string().describe("The email subject line for the quotation reply."),
  body: z.string().describe("The full email body for the quotation reply. Use plain text formatting."),
});

const generateQuoteNode: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Generate Quote Reply");

  const response = await model.withStructuredOutput(quoteOutput).invoke([
    new SystemMessage(
      `You are a professional sales representative for Bombay Tools Supplying Agency Pvt. Ltd. (BTSA).

Your task is to write a quotation email reply to a customer who has requested prices for specific products.

Guidelines:
- Be professional, courteous, and concise
- Address the customer by name
- List each product with its code, description, brand, quantity, unit price, GST rate, and total
- Include HSN codes where available
- Add a subtotal and mention GST applicability
- Mention that prices are subject to availability and may vary
- Include standard terms: delivery timeline, payment terms, validity of quote
- Sign off as "BTSA Sales Team" with contact info
- Use plain text formatting (no HTML or markdown)`
    ),
    new HumanMessage(state.input),
  ]);

  return { subject: response.subject, body: response.body };
};

const graph = new StateGraph(State)
  .addNode("generateQuote", generateQuoteNode)
  .addEdge(START, "generateQuote")
  .addEdge("generateQuote", END)
  .compile();

export interface QuoteInput {
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerNotes?: string | null;
  specialDiscountPercentage?: number | null;
  originalSubject: string;
  products: {
    queryName: string;
    quantity: number;
    brand: string | null;
    description: string | null;
    code: string | null;
    price: number | null;
    hsnCode: string | null;
    gstRate: number | null;
  }[];
}

export async function generateQuoteReply(
  input: QuoteInput
): Promise<{ subject: string; body: string }> {
  const productLines = input.products
    .map(
      (p, i) =>
        `${i + 1}. Product: ${p.description || p.queryName}
   Brand: ${p.brand || "N/A"}
   Code: ${p.code || "N/A"}
   Quantity: ${p.quantity}
   Unit Price: ${p.price != null ? `₹${p.price}` : "Price on request"}
   HSN Code: ${p.hsnCode || "N/A"}
   GST Rate: ${p.gstRate != null ? `${p.gstRate}%` : "N/A"}`
    )
    .join("\n\n");

  const hasCustomerNotes = Boolean(input.customerNotes?.trim());
  const hasSpecialDiscount =
    typeof input.specialDiscountPercentage === "number" &&
    input.specialDiscountPercentage > 0;
  const customerContext =
    hasCustomerNotes || hasSpecialDiscount
      ? `Customer context:
${hasSpecialDiscount ? `- Special discount context: ${input.specialDiscountPercentage}%` : "- Special discount context: none"}
${hasCustomerNotes ? `- Internal customer notes: ${input.customerNotes}` : "- Internal customer notes: none"}

Use this customer context only when it is relevant to tone, terms, relationship, or special handling.
Do not recalculate or alter product prices/totals from the discount context unless explicit discounted prices are provided.`
      : "Customer context: No special customer notes or discount context.";

  const prompt = `Customer: ${input.customerName} from ${input.customerCompany}
Customer Email: ${input.customerEmail}
Original Subject: ${input.originalSubject}

${customerContext}

Products to quote:
${productLines}

Write a professional quotation email reply for these products.`;

  const result = await graph.invoke({ input: prompt });
  return { subject: result.subject, body: result.body };
}
