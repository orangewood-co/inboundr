// Main Agent for RFQ Generation

import { StateSchema, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { TextProductSearcher, getDatabaseConfigFromEnv } from "../utils/product-search";

const EMAIL_RAW_TEXT = `From: industrial innovators <insquar@gmail.com>
Date: Fri, Apr 3, 2026 at 4:30 PM
Subject: Mitutoyo vernier caliper
To: <chennai@btsa.in>




Dear sir,       

       We need mitutoyo vernier caliper 150mm length and 200mm length, please share the quotation.















Thanks & Regards,

NISHANTH D

New Product Mould Development

INDUSTRIAL INNOVATORS

No.1/9, Ganapathy Colony, 2nd Street,

Ekkattuthangal, 

Chennai - 600 032.

Contact No: 9585223382`

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const customer = z.object({
  name: z.string().describe("The name of the person who is sending the email or the person of contact."),
  company: z.string().describe("Name of the company."),
  email: z.email(),
  contactNumber: z.string().nullable(),
  address: z.string().nullable().describe("Address of the company."),
});

const queryProduct = z.object({
  name: z.string(),
  quantity: z.number().default(1),
});

const searchMatch = z.object({
  id: z.number(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  code: z.string().nullable(),
  price: z.number().nullable(),
  hsnCode: z.string().nullable(),
  gstRate: z.number().nullable(),
  link: z.string().nullable(),
  score: z.number(),
  matchReasons: z.array(z.string()),
});

const searchResult = z.object({
  query: queryProduct,
  normalizedQuery: z.string(),
  searchTokens: z.array(z.string()),
  matchedBrand: z.string().nullable(),
  status: z.enum(["matched", "ambiguous", "no_match"]),
  matches: z.array(searchMatch),
});

const State = new StateSchema({
  customer: customer,
  queryProducts: z.array(queryProduct),
  searchResults: z.array(searchResult).nullable(),
});

const identifyCustomer: GraphNode<typeof State> = async () => {
  console.log("NODE: Identify Customer");

  const response = await model.withStructuredOutput(customer).invoke([
    new SystemMessage(
      `
        You are a customer support agent.
        You work for Bombay Tools Supplying Agency Pvt. Ltd.

        You are given a email from a potential customer asking for a quote for the products they are interested in.
        Your task is to identify the customer from the email and return the customer details in the structured output format.
        `
    ),
    new HumanMessage(
      EMAIL_RAW_TEXT
    )
  ]);

  console.log("RESPONSE: ", response);

  return {
    customer: response,
  };
};

const identifyProducts: GraphNode<typeof State> = async () => {
  console.log("NODE: Identify Products");

  const extractedProducts = z.object({
    products: z.array(queryProduct),
  });

  const response = await model.withStructuredOutput(extractedProducts).invoke([
    new SystemMessage(
      `
            You are a product support agent.
            You work for Bombay Tools Supplying Agency Pvt. Ltd.
            
            You are given a email from a potential customer asking for a quote for the products they are interested in.
            Your task is to identify the products from the email and return the products details in the structured output format.
            `
    ),
    new HumanMessage(
      EMAIL_RAW_TEXT
    )
  ]);

  console.log("RESPONSE: ", response);

  return {
    queryProducts: response.products,
  };
};

const searchProducts: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Search Products");

  const searcher = new TextProductSearcher(getDatabaseConfigFromEnv());

  try {
    const searchResults = [];

    for (const product of state.queryProducts) {
      const result = await searcher.searchProduct(product, 5);
      console.log(`SEARCH QUERY: ${product.name}`);
      console.log(
        "SEARCH RESPONSE:",
        result.matches.map((match) => ({
          id: match.id,
          brand: match.brand,
          code: match.code,
          score: match.score,
        }))
      );
      searchResults.push(result);
    }

    return {
      searchResults,
    };
  } finally {
    await searcher.close();
  }
};


const graph = new StateGraph(State)
  .addNode("identifyCustomer", identifyCustomer)
  .addNode("identifyProducts", identifyProducts)
  .addNode("searchProducts", searchProducts)
  .addEdge(START, "identifyCustomer")
  .addEdge("identifyCustomer", "identifyProducts")
  .addEdge("identifyProducts", "searchProducts")
  .addEdge("searchProducts", END)
  .compile();

const result = await graph.invoke({});
console.log("FINAL SEARCH RESULTS:", JSON.stringify(result.searchResults, null, 2));