import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenRouter({
  model: "openai/gpt-5.4-mini",
  temperature: 0.2,
});

const emailOutput = z.object({
  subject: z
    .string()
    .describe(
      "The email subject line. Prefer 'Quotation: <original subject>' or 'Re: <original subject>'."
    ),
  body: z
    .string()
    .describe(
      "The full email body for the quotation reply. Plain text only (no HTML, no markdown)."
    ),
});

const State = new StateSchema({
  prompt: z.string(),
  subject: z.string(),
  body: z.string(),
});

const generateEmailReply: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Generate Email Reply");

  const response = await model.withStructuredOutput(emailOutput).invoke([
    new SystemMessage(
      `You are a professional B2B sales representative for the organization given in the prompt.
You write quotation email replies to customers who have asked for prices.

Hard rules:
- Output plain text only. No HTML, no markdown, no asterisks, no bullets using "*". Use "-" or numbered lines if a list is needed.
- All amounts are in Indian Rupees and must be shown with the "Rs." prefix (e.g. "Rs. 1,250.00"). Do not use any other currency symbol.
- Use ONLY the numbers provided in the "Pricing summary" block of the prompt. Never recompute, round differently, or invent prices, GST, discounts, or totals.
- For any line whose unit price is "Price on request", do NOT make up a number. Mark it clearly as "Price on request" in the line, and exclude it from the totals (the totals block already excludes it).
- Address the customer by first name where possible. Keep tone professional, courteous, and concise.
- Subject format: prefer "Quotation: <original subject>". If the original subject already starts with "Re:" or "Quotation:", keep it as-is or use "Re: <original subject>".
- Body structure:
  1) Greeting referencing the customer.
  2) One short line thanking them for the enquiry and confirming the quote below.
  3) An itemised table-like list of products. For each item include: serial number, product description, brand, product code, HSN code, GST rate, quantity, unit price, line total. Use aligned plain-text columns or a clean numbered list — pick whichever renders cleanly in plain text.
  4) Pricing summary: subtotal, discount (only if non-zero), GST total, grand total. Use the exact values from the "Pricing summary" block.
  5) Standard terms — use the quote payment terms verbatim if provided; otherwise mention: prices subject to availability, validity 15 days from quote date, payment terms as per discussion, GST extra as applicable, delivery timeline to be confirmed on order.
  6) A short closing line inviting questions.
  7) Sign-off using the organization's contact name, organization name, email and phone when provided. Do not invent contact details.

Never include internal customer notes, discount metadata, or any field the customer would not expect to see.`
    ),
    new HumanMessage(state.prompt),
  ]);

  return { subject: response.subject, body: response.body };
};

const graph = new StateGraph(State)
  .addNode("generateEmailReply", generateEmailReply)
  .addEdge(START, "generateEmailReply")
  .addEdge("generateEmailReply", END)
  .compile();

export interface QuoteInput {
  customerName: string;
  customerCompany: string;
  customerEmail: string;
  customerNotes?: string | null;
  specialDiscountPercentage?: number | null;
  organizationName?: string | null;
  organizationContactName?: string | null;
  organizationContactEmail?: string | null;
  organizationContactPhone?: string | null;
  quotePaymentTerms?: string | null;
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

interface PricedLine {
  index: number;
  description: string;
  brand: string;
  code: string;
  hsnCode: string;
  quantity: number;
  unitPriceText: string;
  gstRateText: string;
  lineTotalText: string;
  hasPrice: boolean;
}

interface PricingSummary {
  lines: PricedLine[];
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  gstTotal: number;
  grandTotal: number;
  hasAnyMissingPrice: boolean;
}

const INR = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatINR(n: number): string {
  return `Rs. ${INR.format(n)}`;
}

function computePricing(input: QuoteInput): PricingSummary {
  const discountPercentage =
    typeof input.specialDiscountPercentage === "number" && input.specialDiscountPercentage > 0
      ? input.specialDiscountPercentage
      : 0;

  let subtotal = 0;
  let gstTotal = 0;
  let hasAnyMissingPrice = false;

  const lines: PricedLine[] = input.products.map((p, i) => {
    const hasPrice = typeof p.price === "number" && p.price > 0;
    const quantity = p.quantity > 0 ? p.quantity : 1;
    const gstRate = typeof p.gstRate === "number" ? p.gstRate : 0;

    let lineSubtotal = 0;
    let lineDiscount = 0;
    let lineGst = 0;
    let lineTotal = 0;

    if (hasPrice) {
      lineSubtotal = (p.price as number) * quantity;
      lineDiscount = lineSubtotal * (discountPercentage / 100);
      const lineAfterDiscount = lineSubtotal - lineDiscount;
      lineGst = lineAfterDiscount * (gstRate / 100);
      lineTotal = lineAfterDiscount + lineGst;

      subtotal += lineSubtotal;
      gstTotal += lineGst;
    } else {
      hasAnyMissingPrice = true;
    }

    return {
      index: i + 1,
      description: p.description || p.queryName,
      brand: p.brand || "N/A",
      code: p.code || "N/A",
      hsnCode: p.hsnCode || "N/A",
      quantity,
      unitPriceText: hasPrice ? formatINR(p.price as number) : "Price on request",
      gstRateText: typeof p.gstRate === "number" ? `${p.gstRate}%` : "N/A",
      lineTotalText: hasPrice ? formatINR(lineTotal) : "Price on request",
      hasPrice,
    };
  });

  const discountAmount = subtotal * (discountPercentage / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const grandTotal = subtotalAfterDiscount + gstTotal;

  return {
    lines,
    subtotal,
    discountPercentage,
    discountAmount,
    subtotalAfterDiscount,
    gstTotal,
    grandTotal,
    hasAnyMissingPrice,
  };
}

function renderProductLines(pricing: PricingSummary): string {
  return pricing.lines
    .map(
      (l) =>
        `${l.index}. ${l.description}
   Brand: ${l.brand}
   Code: ${l.code}
   HSN Code: ${l.hsnCode}
   Quantity: ${l.quantity}
   Unit Price: ${l.unitPriceText}
   GST Rate: ${l.gstRateText}
   Line Total: ${l.lineTotalText}`
    )
    .join("\n\n");
}

function renderPricingSummary(pricing: PricingSummary): string {
  const lines: string[] = [];
  lines.push(`Subtotal: ${formatINR(pricing.subtotal)}`);
  if (pricing.discountPercentage > 0) {
    lines.push(
      `Discount (${pricing.discountPercentage}%): -${formatINR(pricing.discountAmount)}`
    );
    lines.push(`Subtotal after discount: ${formatINR(pricing.subtotalAfterDiscount)}`);
  }
  lines.push(`GST total: ${formatINR(pricing.gstTotal)}`);
  lines.push(`Grand total: ${formatINR(pricing.grandTotal)}`);
  if (pricing.hasAnyMissingPrice) {
    lines.push(
      `Note: One or more items are "Price on request" and are NOT included in the totals above.`
    );
  }
  return lines.join("\n");
}

export async function generateQuoteReply(
  input: QuoteInput
): Promise<{ subject: string; body: string }> {
  console.log(
    `INPUT: ${input.customerName} (${input.customerCompany}) — ${input.products.length} products, discount=${input.specialDiscountPercentage ?? 0}%`
  );

  const pricing = computePricing(input);
  const productLines = renderProductLines(pricing);
  const pricingSummary = renderPricingSummary(pricing);

  const hasCustomerNotes = Boolean(input.customerNotes?.trim());
  const customerContext = hasCustomerNotes
    ? `Internal customer notes (do NOT quote verbatim, use only to adjust tone/relationship): ${input.customerNotes}`
    : "No internal customer notes.";

  const prompt = `Customer:
- Name: ${input.customerName}
- Company: ${input.customerCompany}
- Email: ${input.customerEmail}
- Original subject: ${input.originalSubject}

Organization:
- Name: ${input.organizationName || "Bombay Tools Supplying Agency Pvt. Ltd. (BTSA)"}
- Contact name: ${input.organizationContactName || "BTSA Sales Team"}
- Contact email: ${input.organizationContactEmail || "N/A"}
- Contact phone: ${input.organizationContactPhone || "N/A"}
- Payment terms: ${input.quotePaymentTerms || "Prices subject to availability. Validity 15 days from quote date. Payment terms as per discussion. GST extra as applicable. Delivery timeline to be confirmed on order."}

${customerContext}

Products to quote:
${productLines}

Pricing summary (authoritative — use these exact numbers, do NOT recompute):
${pricingSummary}

Write the quotation email reply now.`;

  const result = await graph.invoke({ prompt });
  return { subject: result.subject, body: result.body };
}
