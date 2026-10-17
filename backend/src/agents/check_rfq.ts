import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenRouter({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

export type RFQInputChannel = "email" | "whatsapp";

const SYSTEM_PROMPTS: Record<RFQInputChannel, string> = {
  email: `You are a RFQ email checker.
       You are given an email and you need to check if it is an RFQ email.`,
  whatsapp: `You are a RFQ checker for a business WhatsApp number that customers use to ask for quotations.
       You are given a WhatsApp chat. Messages under "EARLIER MESSAGES" are context only; decide based on the messages under "NEW MESSAGES".
       They are an RFQ if they ask for a price, quotation, rate or availability of products, or name products and quantities the customer wants
       (including photos or documents of a product list or a purchase requirement).
       Greetings, thanks, order or payment status questions, complaints and small talk are not RFQs.`,
};

const State = new StateSchema({
  isRFQemail: z.boolean(),
  emailBody: z.string(),
  channel: z.enum(["email", "whatsapp"]),
  reason: z.string(),
});

const checkRFQ: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Check RFQ");

  const isRFQemail = z.object({
    isRFQemail: z.boolean(),
    reason: z.string(),
  });

  const response = await model.withStructuredOutput(isRFQemail).invoke([
    new SystemMessage(SYSTEM_PROMPTS[state.channel]),
    new HumanMessage(state.emailBody),
  ]);
  return { isRFQemail: response.isRFQemail, reason: response.reason };
};

const graph = new StateGraph(State)
  .addNode("checkRFQ", checkRFQ)
  .addEdge(START, "checkRFQ")
  .addEdge("checkRFQ", END)
  .compile();

export async function classifyEmail(
  emailBody: string,
  channel: RFQInputChannel = "email"
): Promise<{ isRFQemail: boolean; reason: string }> {
  const result = await graph.invoke({ emailBody, channel });
  return { isRFQemail: result.isRFQemail, reason: result.reason };
}
