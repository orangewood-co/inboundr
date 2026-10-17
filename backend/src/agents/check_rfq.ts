import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { TypeSafeClassifier } from "@langchain/typesafe";

const RFQ_THRESHOLD = 0.7;

const classifier = new TypeSafeClassifier({
  model: "typesafe/jev-1.14",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: "https://openrouter.ai/api",
  questions: {
    isRFQ: {
      type: "noul",
      instructions: "Is the person asking for a quote?",
    },
  },
});

const State = new StateSchema({
  isRFQ: z.boolean(),
  emailBody: z.string(),
});

const checkRFQ: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Check RFQ");

  const response = await classifier.invoke({ email: state.emailBody });
  const answer = response.nouls.isRFQ;
  if (!answer) {
    throw new Error("TypeSafe response did not include an isRFQ answer");
  }

  return {
    isRFQ: answer.noul >= RFQ_THRESHOLD,
  };
};

const graph = new StateGraph(State)
  .addNode("checkRFQ", checkRFQ)
  .addEdge(START, "checkRFQ")
  .addEdge("checkRFQ", END)
  .compile();

export async function classifyEmail(
  emailBody: string
): Promise<{ isRFQ: boolean }> {
  const result = await graph.invoke({ emailBody });
  return { isRFQ: result.isRFQ };
}
