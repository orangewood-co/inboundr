// Main Agent for RFQ Generation

import { StateSchema, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { connectDB, disconnectDB } from "../config/database.config";
import { closePostgresPool } from "../db/postgres";
import { generateRFQ } from "./generate_rfq";
import { generateQuoteReply } from "./generate_quote";
import { classifyEmail } from "./check_rfq";


const EMAIL_RAW_TEXT = `
       Dear Sir,

 

Kindly share the quote for lever dial (0.001mm) least count.

 

Regards

SHAFI. P. K

Tool Engineering

Autoplast

+91 8904610630

 
`


try {
       await connectDB();

       // const { customer, queryProducts, searchResults } = await generateRFQ(
       //   {
       //     name: process.env.ORGANIZATION_NAME || "Organization",
       //     description: process.env.ORGANIZATION_DESCRIPTION || "",
       //     searchInstructions: "",
       //   },
       //   EMAIL_RAW_TEXT,
       //   process.env.ORGANIZATION_ID
       // );

       // console.log("FINAL SEARCH RESULTS:", JSON.stringify(searchResults, null, 2));
       // console.log("CUSTOMER:", JSON.stringify(customer, null, 2));
       // console.log("QUERY PRODUCTS:", JSON.stringify(queryProducts, null, 2));

       // const quoteReply = await generateQuoteReply({
       //  customerName: customer.name,
       //  customerCompany: customer.company,
       //  customerEmail: customer.email ?? "",
       //  customerNotes: null,
       //  specialDiscountPercentage: 0,
       //  originalSubject: "Mitutoyo vernier caliper",
       //  products: queryProducts.map((product) => ({
       //    queryName: product.name,
       //    quantity: product.quantity,
       //    brand: null,
       //    description: null,
       //    code: null,
       //    price: null,
       //    hsnCode: null,
       //    gstRate: null,
       //  })),
       // });

       // console.log("QUOTE REPLY:", JSON.stringify(quoteReply, null, 2));

       const isRFQ = await classifyEmail(EMAIL_RAW_TEXT);
       console.log("IS RFQ:", JSON.stringify(isRFQ, null, 2));
} catch (error) {
       console.error("ERROR:", error);
} finally {
       await disconnectDB();
       await closePostgresPool();
}