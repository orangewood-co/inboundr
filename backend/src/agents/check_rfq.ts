import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenRouter({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

const State = new StateSchema({
  isRFQemail: z.boolean(),
  emailBody: z.string(),
  reason: z.string(),
});

const checkRFQ: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Check RFQ");

  const isRFQemail = z.object({
    isRFQemail: z.boolean(),
    reason: z.string(),
  });

  const response = await model.withStructuredOutput(isRFQemail).invoke([
    new SystemMessage(
      `You are a RFQ email checker.
You are given an email and you need to check if it is an RFQ email.`
    ),
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
  emailBody: string
): Promise<{ isRFQemail: boolean; reason: string }> {
  const result = await graph.invoke({ emailBody });
  return { isRFQemail: result.isRFQemail, reason: result.reason };
}
