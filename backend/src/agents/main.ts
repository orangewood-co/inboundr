// Main Agent for RFQ Generation

import { StateSchema, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { TextProductSearcher, getDatabaseConfigFromEnv } from "../utils/product-search";

import { connectDB, disconnectDB } from "../config/database.config";
import { generateRFQ } from "./generate_rfq";
import { generateQuoteReply } from "./generate_quote";



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


try {
       await connectDB();

       const { customer, queryProducts, searchResults } = await generateRFQ(
         {
           name: process.env.ORGANIZATION_NAME || "Organization",
           description: process.env.ORGANIZATION_DESCRIPTION || "",
           searchInstructions: "",
         },
         EMAIL_RAW_TEXT,
         process.env.ORGANIZATION_ID
       );

       console.log("FINAL SEARCH RESULTS:", JSON.stringify(searchResults, null, 2));
       console.log("CUSTOMER:", JSON.stringify(customer, null, 2));
       console.log("QUERY PRODUCTS:", JSON.stringify(queryProducts, null, 2));

       const quoteReply = await generateQuoteReply({
        customerName: customer.name,
        customerCompany: customer.company,
        customerEmail: customer.email ?? "",
        customerNotes: null,
        specialDiscountPercentage: 0,
        originalSubject: "Mitutoyo vernier caliper",
        products: queryProducts.map((product) => ({
          queryName: product.name,
          quantity: product.quantity,
          brand: null,
          description: null,
          code: null,
          price: null,
          hsnCode: null,
          gstRate: null,
        })),
       });

       console.log("QUOTE REPLY:", JSON.stringify(quoteReply, null, 2));
} catch (error) {
       console.error("ERROR:", error);
} finally {
       await disconnectDB();
}