import { ChatOpenRouter } from "@langchain/openrouter";
import { Call, type ICall, type ICallExtraction } from "../models/call.model";
import { Customer } from "../models/customer.model";

const extractionModel = new ChatOpenRouter({
  model: process.env.VOICE_EXTRACTION_MODEL || "openai/gpt-5.5-mini",
  temperature: 0,
});

interface ExtractionResult {
  summary: string;
  callerName: string;
  company: string;
  email: string;
  inquiry: string;
  followUpRequired: boolean;
}

function transcriptText(call: ICall): string {
  return call.transcript
    .map((entry) => `${entry.role === "user" ? "Caller" : "Agent"}: ${entry.text}`)
    .join("\n");
}

function parseExtractionJson(raw: string): ExtractionResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? "").trim(),
      callerName: String(parsed.callerName ?? "").trim(),
      company: String(parsed.company ?? "").trim(),
      email: String(parsed.email ?? "").trim().toLowerCase(),
      inquiry: String(parsed.inquiry ?? "").trim(),
      followUpRequired: Boolean(parsed.followUpRequired),
    };
  } catch {
    return null;
  }
}

async function extractLeadFromTranscript(call: ICall): Promise<ExtractionResult | null> {
  const text = transcriptText(call);
  if (!text.trim()) return null;

  const prompt = `You are analyzing the transcript of an inbound business phone call answered by an AI receptionist.
The caller's phone number is ${call.callerNumber || "unknown"}.

Transcript:
${text}

Reply with ONLY a JSON object (no markdown, no explanation) with exactly these keys:
{
  "summary": "2-3 sentence summary of the call",
  "callerName": "caller's name, or empty string if not given",
  "company": "caller's company, or empty string",
  "email": "caller's email address, or empty string",
  "inquiry": "what the caller wants, one sentence, or empty string",
  "followUpRequired": true or false (does the business need to follow up?)
}`;

  try {
    const response = await extractionModel.invoke([{ role: "user", content: prompt }]);
    return parseExtractionJson(String(response.content));
  } catch (err) {
    console.error("Voice call extraction failed:", err);
    return null;
  }
}

/**
 * Matches the caller to an existing customer by phone or extracted email.
 * Creates a new customer only when the caller shared an email (the Customer
 * schema requires one); otherwise the lead details stay on the call record.
 */
async function matchOrCreateCustomer(
  call: ICall,
  extraction: ExtractionResult
): Promise<string | null> {
  if (call.callerNumber) {
    const byPhone = await Customer.findOne({
      organizationId: call.organizationId,
      contactNumber: call.callerNumber,
    }).lean();
    if (byPhone) return String(byPhone._id);
  }

  if (extraction.email) {
    const byEmail = await Customer.findOne({
      organizationId: call.organizationId,
      email: extraction.email,
    }).lean();
    if (byEmail) return String(byEmail._id);

    const created = await Customer.create({
      organizationId: call.organizationId,
      name: extraction.callerName || "Phone caller",
      company: extraction.company || extraction.callerName || "Unknown",
      email: extraction.email,
      contactNumber: call.callerNumber || null,
      notes: extraction.inquiry ? `Created from inbound call. Inquiry: ${extraction.inquiry}` : "Created from inbound call.",
    });
    return String(created._id);
  }

  return null;
}

/** Post-call processing: summarize the transcript, extract the lead, and link/create the customer. */
export async function processCompletedCall(callId: string): Promise<void> {
  const call = await Call.findById(callId);
  if (!call) return;

  const extraction = await extractLeadFromTranscript(call);
  if (!extraction) return;

  const update: Partial<ICall> = {
    summary: extraction.summary,
    extraction: {
      callerName: extraction.callerName,
      company: extraction.company,
      email: extraction.email,
      inquiry: extraction.inquiry,
      followUpRequired: extraction.followUpRequired,
    } as ICallExtraction,
  };

  try {
    const customerId = await matchOrCreateCustomer(call, extraction);
    if (customerId) {
      update.customerId = customerId as unknown as ICall["customerId"];
    }
  } catch (err) {
    console.error("Failed to match or create customer for call:", err);
  }

  await Call.findByIdAndUpdate(callId, { $set: update });
}
