import { StateSchema, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  TextProductSearcher,
  extractDimensionTokens,
  extractNormalizedCodeHints,
  extractProductFamilyAnchorTokens,
  getDatabaseConfigFromEnv,
  normalizeProductSearchText,
  productMatchesAnchorTokens,
  resolveProductMatchStatus,
  type ProductSearchGroup,
  type ProductSearchMatch,
} from "../utils/product-search";
import { Customer } from "../models/customer.model";

const model = new ChatOpenRouter({
  model: "openai/gpt-5.4-mini",
  temperature: 0,
});

const customer = z.object({
  name: z.string().describe("The name of the person who is sending the email or the person of contact."),
  company: z.string().describe("Name of the company."),
  email: z.string().nullable().describe("Email address of the customer."),
  contactNumber: z.string().nullable(),
  address: z.string().nullable().describe("Address of the company."),
});

const queryProduct = z.object({
  name: z.string(),
  quantity: z.number().default(1),
});

const searchMatch = z.object({
  id: z.string(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  code: z.string().nullable(),
  price: z.number().nullable(),
  hsnCode: z.string().nullable(),
  gstRate: z.number().nullable(),
  link: z.string().nullable(),
  isTopSeller: z.boolean().default(false),
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

const aiSearchExpansion = z.object({
  correctedQuery: z.string().nullable(),
  brand: z.string().nullable(),
  productType: z.string().nullable(),
  specifications: z.array(z.string()).default([]),
  codeHints: z.array(z.string()).default([]),
  alternateQueries: z.array(z.string()).default([]),
});

const aiRerankResult = z.object({
  rankedMatches: z.array(
    z.object({
      id: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

type QueryProduct = z.infer<typeof queryProduct>;
type AiSearchExpansion = z.infer<typeof aiSearchExpansion>;

const FINAL_MATCH_LIMIT = 5;
const SEARCH_CANDIDATE_LIMIT = 8;
const RERANK_CANDIDATE_LIMIT = 12;
const MAX_SEARCH_VARIANTS = 6;

const State = new StateSchema({
  emailBody: z.string(),
  organizationId: z.string().nullable(),
  customer: customer,
  queryProducts: z.array(queryProduct),
  searchResults: z.array(searchResult).nullable(),
});

const identifyCustomer: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Identify Customer");

  const response = await model.withStructuredOutput(customer).invoke([
    new SystemMessage(
       `You are a customer support agent.
        You work for Bombay Tools Supplying Agency Pvt. Ltd.

        You are given a email from a potential customer asking for a quote for the products they are interested in.
        Your task is to identify the customer from the email and return the customer details in the structured output format.`
    ),
    new HumanMessage(state.emailBody),
  ]);

  console.log("RESPONSE: ", response);

  // Check if the customer already exists
  const customerFilter = {
    email: response.email ?? "",
    ...(state.organizationId ? { organizationId: state.organizationId } : {}),
  };
  const existingCustomer = await Customer.findOne(customerFilter);
  if (existingCustomer) {
    return {
      customer: {
        name: response.name,
        company: response.company,
        email: response.email ?? "",
        contactNumber: response.contactNumber ?? null,
        address: response.address ?? "",
      },
    };
  }
  else {
    await Customer.create({
      ...(state.organizationId ? { organizationId: state.organizationId } : {}),
      name: response.name,
      company: response.company,
      email: response.email ?? "",
      contactNumber: response.contactNumber ?? undefined,
      address: response.address ?? "",
    });
  }

  return {
    customer: response,
  };
};

const identifyProducts: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Identify Products");
  console.log("EMAIL BODY: ", state.emailBody);

  const extractedProducts = z.object({
    products: z.array(queryProduct),
  });

  const response = await model.withStructuredOutput(extractedProducts).invoke([
    new SystemMessage(
      `You are a product support agent.
       You work for Bombay Tools Supplying Agency Pvt. Ltd.

       You are given a email from a potential customer asking for a quote for the products they are interested in.
       Your task is to identify the products from the email and return the products details in the structured output format.
       
       Pay attention to the product make and specification if given and include them in the product nam
       `

    ),
    new HumanMessage(state.emailBody),
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
      if (!state.organizationId) {
        throw new Error("Organization context is required for product search");
      }

      const expansion = await expandProductSearchQuery(product);
      const searchQueries = buildProductSearchQueries(product.name, expansion);
      const originalAnchorTokens = getAnchorTokensForSearchText(product.name);
      const candidateGroups = await Promise.all(
        searchQueries.map((searchQuery) =>
          searcher.searchProduct({ ...product, name: searchQuery }, state.organizationId!, SEARCH_CANDIDATE_LIMIT)
        )
      );
      const mergedResult = filterSearchResultByAnchor(
        mergeSearchResults(product, candidateGroups),
        originalAnchorTokens
      );
      const result = limitSearchResultMatches(
        await rerankProductMatches(product, expansion, mergedResult),
        FINAL_MATCH_LIMIT
      );

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

async function expandProductSearchQuery(product: QueryProduct): Promise<AiSearchExpansion | null> {
  try {
    const response = await model.withStructuredOutput(aiSearchExpansion).invoke([
      new SystemMessage(
        `You improve industrial tools catalog search queries.

Return corrected and expanded search terms for a buyer's product request.
Preserve exact model numbers, catalogue codes, dimensions, ranges, units, and brand names.
Fix obvious typos such as ":itutoyo" -> "Mitutoyo".
Expand common wording such as "mike" or "mic" -> "micrometer" and "digimatic" -> "digital".
Do not invent a product. Do not return product ids. Only return terms useful for database search.
Every alternate query must keep the product family words from the buyer request, such as "caliper", "vernier", or "micrometer".
Do not return bare dimension-only alternate queries such as "150mm", "300mm", or "0-50mm".

Examples:
- "Micrometer - 0-50 mm" should include "micrometer 0-50mm" and may include "depth micrometer 0-50mm".
- ":itutoyo 0/25 Digimatic Mike 293/340" should include brand "Mitutoyo", product type "digital micrometer", range "0-25mm", and code hints like "293340" and "293-340".`
      ),
      new HumanMessage(`Product request: ${product.name}\nQuantity: ${product.quantity}`),
    ]);

    return {
      correctedQuery: response.correctedQuery,
      brand: response.brand,
      productType: response.productType,
      specifications: response.specifications ?? [],
      codeHints: response.codeHints ?? [],
      alternateQueries: response.alternateQueries ?? [],
    };
  } catch (error) {
    console.warn("AI product search expansion failed:", error);
    return null;
  }
}

function buildProductSearchQueries(originalQuery: string, expansion: AiSearchExpansion | null): string[] {
  const originalAnchorTokens = getAnchorTokensForSearchText(originalQuery);
  const expandedStructuredQuery = [
    expansion?.brand,
    expansion?.productType,
    ...(expansion?.specifications ?? []),
    ...(expansion?.codeHints ?? []),
  ]
    .filter(isNonEmptyString)
    .join(" ");

  return uniqueByNormalizedText([
    originalQuery,
    expansion?.correctedQuery ?? "",
    expandedStructuredQuery,
    ...(expansion?.alternateQueries ?? []),
    ...(expansion?.codeHints ?? []),
  ])
    .filter((query) => shouldKeepSearchVariant(query, originalAnchorTokens))
    .slice(0, MAX_SEARCH_VARIANTS);
}

function shouldKeepSearchVariant(query: string, originalAnchorTokens: string[]): boolean {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) {
    return false;
  }

  if (originalAnchorTokens.length === 0) {
    return true;
  }

  const variantAnchorTokens = getAnchorTokensForSearchText(normalizedQuery);
  if (variantAnchorTokens.length > 0) {
    return true;
  }

  return extractNormalizedCodeHints(normalizedQuery).length > 0 && !isBareDimensionSearchVariant(normalizedQuery);
}

function filterSearchResultByAnchor(
  result: ProductSearchGroup,
  anchorTokens: string[]
): ProductSearchGroup {
  if (anchorTokens.length === 0) {
    return result;
  }

  const matches = result.matches.filter((match) => productMatchesAnchorTokens(match, anchorTokens));

  return {
    ...result,
    matches,
    matchedBrand: matches[0]?.brand ?? null,
    status: resolveProductMatchStatus(matches),
  };
}

function mergeSearchResults(query: QueryProduct, groups: ProductSearchGroup[]): ProductSearchGroup {
  const matchesById = new Map<string, ProductSearchMatch>();
  const searchTokens = uniqueStrings(groups.flatMap((group) => group.searchTokens));
  const primaryNormalizedQuery = groups[0]?.normalizedQuery ?? "";

  for (const group of groups) {
    const fromExpandedQuery = normalizeForDedup(group.query.name) !== normalizeForDedup(query.name);

    for (const match of group.matches) {
      const existingMatch = matchesById.get(match.id);
      const matchReasons = uniqueStrings([
        ...(existingMatch?.matchReasons ?? []),
        ...match.matchReasons,
        ...(fromExpandedQuery ? ["ai_query_expansion"] : []),
      ]);

      if (!existingMatch || match.score > existingMatch.score) {
        matchesById.set(match.id, {
          ...match,
          score: Math.max(match.score, existingMatch?.score ?? 0),
          matchReasons,
        });
      } else {
        matchesById.set(match.id, {
          ...existingMatch,
          matchReasons,
        });
      }
    }
  }

  const matches = [...matchesById.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return (left.description ?? "").length - (right.description ?? "").length;
  });

  return {
    query,
    normalizedQuery: primaryNormalizedQuery,
    searchTokens,
    matchedBrand: matches[0]?.brand ?? null,
    status: resolveProductMatchStatus(matches),
    matches,
  };
}

async function rerankProductMatches(
  query: QueryProduct,
  expansion: AiSearchExpansion | null,
  result: ProductSearchGroup
): Promise<ProductSearchGroup> {
  if (result.matches.length <= 1) {
    return result;
  }

  const candidates = result.matches.slice(0, RERANK_CANDIDATE_LIMIT);

  try {
    const response = await model.withStructuredOutput(aiRerankResult).invoke([
      new SystemMessage(
        `You rerank real catalog candidates for an RFQ product search.

Use only the provided candidates. Return candidate ids in best-match order.
Prefer matches with the same brand, product family, dimensions/range, units, catalogue/model code, and clear synonyms.
Prefer top seller candidates only when their product relevance is otherwise close.
Penalize candidates with conflicting product type, range, or brand.
If several candidates are close variants, keep them ranked but use lower confidence.`
      ),
      new HumanMessage(
        JSON.stringify(
          {
            request: query,
            expansion,
            candidates: candidates.map((candidate) => ({
              id: candidate.id,
              brand: candidate.brand,
              code: candidate.code,
              description: candidate.description,
              isTopSeller: candidate.isTopSeller,
              score: candidate.score,
              matchReasons: candidate.matchReasons,
            })),
          },
          null,
          2
        )
      ),
    ]);

    const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const usedIds = new Set<string>();
    const confidenceById = new Map<string, number>();
    const rerankedMatches: ProductSearchMatch[] = [];

    for (const rankedMatch of response.rankedMatches) {
      const candidate = candidatesById.get(rankedMatch.id);
      if (!candidate || usedIds.has(rankedMatch.id)) {
        continue;
      }

      usedIds.add(rankedMatch.id);
      confidenceById.set(rankedMatch.id, rankedMatch.confidence);
      rerankedMatches.push({
        ...candidate,
        matchReasons: uniqueStrings([...candidate.matchReasons, "ai_rerank"]),
      });
    }

    if (rerankedMatches.length === 0) {
      return result;
    }

    const remainingMatches = result.matches.filter((match) => !usedIds.has(match.id));
    const matches = [...rerankedMatches, ...remainingMatches];

    return {
      ...result,
      matches,
      matchedBrand: matches[0]?.brand ?? null,
      status: resolveAiMatchStatus(matches, confidenceById),
    };
  } catch (error) {
    console.warn("AI product search rerank failed:", error);
    return result;
  }
}

function resolveAiMatchStatus(
  matches: ProductSearchMatch[],
  confidenceById: Map<string, number>
): "matched" | "ambiguous" | "no_match" {
  if (matches.length === 0) {
    return "no_match";
  }

  if (matches.length === 1) {
    return "matched";
  }

  const [topMatch, secondMatch] = matches;
  const topConfidence = topMatch ? confidenceById.get(topMatch.id) : undefined;
  const secondConfidence = secondMatch ? confidenceById.get(secondMatch.id) ?? 0 : 0;

  if (topConfidence != null && topConfidence >= 0.82 && topConfidence - secondConfidence >= 0.2) {
    return "matched";
  }

  return "ambiguous";
}

function limitSearchResultMatches(result: ProductSearchGroup, limit: number): ProductSearchGroup {
  const matches = result.matches.slice(0, limit);

  return {
    ...result,
    matches,
    matchedBrand: matches[0]?.brand ?? null,
    status: matches.length === 0 ? "no_match" : result.status,
  };
}

function uniqueByNormalizedText(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!isNonEmptyString(value)) {
      continue;
    }

    const normalizedValue = normalizeForDedup(value);
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    uniqueValues.push(value.trim());
  }

  return uniqueValues;
}

function normalizeForDedup(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getAnchorTokensForSearchText(value: string): string[] {
  const normalizedValue = normalizeProductSearchText(value);
  return extractProductFamilyAnchorTokens(normalizedValue.split(" ").filter(Boolean));
}

function isBareDimensionSearchVariant(value: string): boolean {
  const normalizedValue = normalizeProductSearchText(value);
  const tokens = normalizedValue.split(" ").filter(Boolean);
  const dimensionTokens = new Set(extractDimensionTokens(normalizedValue));

  return tokens.length > 0 && tokens.every((token) => dimensionTokens.has(token));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(isNonEmptyString))];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const graph = new StateGraph(State)
  .addNode("identifyCustomer", identifyCustomer)
  .addNode("identifyProducts", identifyProducts)
  .addNode("searchProducts", searchProducts)
  .addEdge(START, "identifyCustomer")
  .addEdge("identifyCustomer", "identifyProducts")
  .addEdge("identifyProducts", "searchProducts")
  .addEdge("searchProducts", END)
  .compile();

export async function generateRFQ(emailBody: string, organizationId?: string): Promise<{
  customer: z.infer<typeof customer>;
  queryProducts: z.infer<typeof queryProduct>[];
  searchResults: z.infer<typeof searchResult>[];
}> {
  const result = await graph.invoke({ emailBody, organizationId: organizationId ?? null });
  return {
    customer: result.customer,
    queryProducts: result.queryProducts,
    searchResults: result.searchResults ?? [],
  };
}
