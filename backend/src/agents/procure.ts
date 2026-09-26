import { END, START, StateGraph, StateSchema, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { ChatOpenRouter } from "@langchain/openrouter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Types } from "mongoose";
import { searchSuppliersCached } from "../procurement/supplier-search";
import type { SupplierListing } from "../procurement/supplier-search.types";
import type {
  IProcurementCandidate,
  IProcurementCheck,
  IProcurementDebug,
  IProcurementRequirement,
  IProcurementSummary,
} from "../models/procurement-run.model";

const MODEL_NAME = process.env.PROCUREMENT_MODEL?.trim() || "deepseek/deepseek-v4-flash";
const MAX_SEARCH_QUERIES = 4;
const LISTINGS_PER_QUERY = 12;
const MAX_ASSESSED_LISTINGS = 24;
const MAX_CANDIDATES = 10;
const MIN_SPEC_MATCH = 0.35;
const SCORE_WEIGHTS = { specMatch: 0.45, price: 0.2, location: 0.15, trust: 0.2 };
const MOQ_PENALTY = 0.85;

const model = new ChatOpenRouter({ model: MODEL_NAME, temperature: 0 });

// Major industrial cities, used to infer the customer's state from a free-text address.
const CITY_STATES: Record<string, string> = {
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  madurai: "Tamil Nadu",
  tiruppur: "Tamil Nadu",
  hosur: "Tamil Nadu",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  thane: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  aurangabad: "Maharashtra",
  bengaluru: "Karnataka",
  bangalore: "Karnataka",
  mysuru: "Karnataka",
  ahmedabad: "Gujarat",
  surat: "Gujarat",
  vadodara: "Gujarat",
  rajkot: "Gujarat",
  delhi: "Delhi",
  noida: "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  gurugram: "Haryana",
  gurgaon: "Haryana",
  faridabad: "Haryana",
  kolkata: "West Bengal",
  hyderabad: "Telangana",
  secunderabad: "Telangana",
  visakhapatnam: "Andhra Pradesh",
  ludhiana: "Punjab",
  jalandhar: "Punjab",
  jaipur: "Rajasthan",
  indore: "Madhya Pradesh",
  kochi: "Kerala",
  bhubaneswar: "Odisha",
};

const requirementSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  code: z.string().nullable(),
  manufacturer: z.string().nullable(),
  specifications: z.record(z.string(), z.string()),
  notes: z.string().nullable(),
});

const settingsSchema = z.object({
  instructions: z.string(),
  preferredStates: z.array(z.string()),
  excludedKeywords: z.array(z.string()),
  requireGstRegistered: z.boolean(),
  requireVerifiedSupplier: z.boolean(),
});

const checkOutputSchema = z.object({
  decision: z.enum(["proceed", "needs_clarification", "out_of_scope"]),
  reason: z.string().describe("One or two sentences explaining the decision, written for the buyer."),
  productType: z.string().nullable().describe("The generic item type, e.g. 'vernier caliper'."),
  missingInformation: z.array(z.string()).describe("Details needed before searching. Empty unless needs_clarification."),
  searchQueries: z.array(z.string()).describe("1 to 4 short directory search phrases, most specific first."),
  mustHave: z.array(z.string()).describe("Requested attributes a listing must match."),
  niceToHave: z.array(z.string()).describe("Attributes that help but aren't required."),
});

const assessmentSchema = z.object({
  assessments: z.array(
    z.object({
      listingId: z.string(),
      specMatch: z.number().min(0).max(1),
      matched: z.array(z.string()).describe("Short phrases for requested attributes the listing clearly matches."),
      conflicts: z.array(z.string()).describe("Short phrases for requested attributes the listing contradicts or lacks."),
    })
  ),
});

type Assessment = z.infer<typeof assessmentSchema>["assessments"][number];
type QueryLogEntry = IProcurementDebug["queries"][number];

const State = new StateSchema({
  organizationId: z.string(),
  organization: z.object({ name: z.string(), description: z.string() }),
  settings: settingsSchema,
  requirement: requirementSchema,
  customerLocation: z.string().nullable(),
  searchAnyway: z.boolean(),
  check: z.custom<IProcurementCheck>().nullable(),
  listings: z.array(z.custom<SupplierListing>()),
  queryLog: z.array(z.custom<QueryLogEntry>()),
  candidates: z.array(z.custom<IProcurementCandidate>()),
  summary: z.custom<IProcurementSummary>().nullable(),
});

type ProcureState = typeof State.State;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function requirementText(requirement: IProcurementRequirement): string {
  return [
    requirement.name,
    requirement.manufacturer,
    requirement.code,
    ...Object.entries(requirement.specifications).map(([key, value]) => `${key} ${value}`),
    requirement.notes,
  ]
    .filter(Boolean)
    .join(" ");
}

function findExcludedKeyword(requirement: IProcurementRequirement, keywords: string[]): string | null {
  const text = ` ${normalize(requirementText(requirement))} `;
  for (const keyword of keywords) {
    const normalized = normalize(keyword);
    if (normalized && text.includes(` ${normalized} `)) return keyword.trim();
  }
  return null;
}

function inferState(location: string | null): { city: string | null; state: string | null } {
  if (!location) return { city: null, state: null };
  const text = normalize(location);
  for (const [city, state] of Object.entries(CITY_STATES)) {
    if (new RegExp(`\\b${city}\\b`).test(text)) return { city, state };
  }
  const states = new Set(Object.values(CITY_STATES));
  for (const state of states) {
    if (text.includes(normalize(state))) return { city: null, state };
  }
  return { city: null, state: null };
}

function formatQuantity(quantity: number, unit: string | null): string {
  const label = unit?.trim() || (quantity === 1 ? "piece" : "pieces");
  return `${quantity} ${label.toLowerCase()}`;
}

const checkRequirements: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Check Requirements");

  const excluded = findExcludedKeyword(state.requirement, state.settings.excludedKeywords);
  if (excluded) {
    return {
      check: {
        decision: "out_of_scope",
        reason: `This item matches "${excluded}", which is excluded in your sourcing preferences.`,
        productType: null,
        missingInformation: [],
        searchQueries: [],
        mustHave: [],
        niceToHave: [],
      },
    };
  }

  const response = await model.withStructuredOutput(checkOutputSchema).invoke([
    new SystemMessage(
      `You are the procurement desk for ${state.organization.name}.
${state.organization.description}

A customer asked us to quote an item that isn't in our catalog. Decide whether we should look for it on a B2B supplier directory (IndiaMART), and turn it into search criteria.

Sourcing guidance from the organization:
${state.settings.instructions || "No additional guidance."}

Decisions:
- proceed: the item is specific enough to find the right product, and it fits the sourcing guidance.
- needs_clarification: the request is too vague to find the right product, for example a bare item type with no size, rating, model, or brand where those clearly matter. List exactly what is missing.
- out_of_scope: the sourcing guidance says we don't source this kind of item, or it isn't a purchasable physical product (a service, a job, a document).

Treat "notes" as extra detail from our own team; it overrides the original request.
Search queries must preserve exact model and part numbers, brand, sizes, and units. Never invent specifications that weren't requested.
mustHave lists only what the buyer actually asked for (include the brand only if they named one).`
    ),
    new HumanMessage(
      JSON.stringify({ requirement: state.requirement, customerLocation: state.customerLocation }, null, 2)
    ),
  ]);

  let decision = response.decision;
  let reason = response.reason;
  if (decision === "needs_clarification" && state.searchAnyway) {
    decision = "proceed";
    reason = `Searching anyway as requested. ${reason}`;
  }

  const { manufacturer, name } = state.requirement;
  const fallbackQuery =
    manufacturer && !normalize(name).includes(normalize(manufacturer)) ? `${manufacturer} ${name}` : name;
  const searchQueries = uniqueText([...response.searchQueries, fallbackQuery]).slice(0, MAX_SEARCH_QUERIES);

  return {
    check: {
      decision,
      reason,
      productType: response.productType,
      missingInformation: decision === "needs_clarification" ? response.missingInformation : [],
      searchQueries,
      mustHave: uniqueText(response.mustHave),
      niceToHave: uniqueText(response.niceToHave),
    },
  };
};

const routeAfterCheck = (state: ProcureState) =>
  state.check?.decision === "proceed" ? "searchSuppliers" : END;

const searchSuppliers: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Search Suppliers");

  const organizationId = new Types.ObjectId(state.organizationId);
  const queries = state.check?.searchQueries ?? [];
  const results = await Promise.all(
    queries.map(async (query) => ({
      query,
      ...(await searchSuppliersCached(organizationId, {
        query,
        brand: state.requirement.manufacturer,
        limit: LISTINGS_PER_QUERY,
      })),
    }))
  );

  const listings = new Map<string, SupplierListing>();
  for (const result of results) {
    for (const listing of result.listings) {
      if (!listings.has(listing.listingId)) listings.set(listing.listingId, listing);
    }
  }

  return {
    listings: [...listings.values()],
    queryLog: results.map((result) => ({
      query: result.query,
      resultCount: result.listings.length,
      fromCache: result.fromCache,
    })),
  };
};

async function assessListings(state: ProcureState, listings: SupplierListing[]): Promise<Map<string, Assessment>> {
  const assessments = new Map<string, Assessment>();
  if (listings.length === 0) return assessments;

  try {
    const response = await model.withStructuredOutput(assessmentSchema).invoke([
      new SystemMessage(
        `You check supplier listings against a buyer's requirement.

Judge only from each listing's title, brand, model number, and specifications. Don't assume details a listing doesn't state.
Score specMatch from 0 to 1:
- 0.9 to 1: same item type and every must-have attribute matches.
- 0.6 to 0.8: same item type, a must-have is unstated, or it's a different brand when the buyer named one.
- 0.3 to 0.5: same item type but a must-have size, rating, or code conflicts.
- 0 to 0.2: a different item type, such as a service, spare parts, or an accessory when the buyer wants the item itself.
Keep matched and conflicts phrases short, like "150mm length" or "Brand is Apex, not Mitutoyo".
Return one assessment for every listing id.`
      ),
      new HumanMessage(
        JSON.stringify(
          {
            requirement: state.requirement,
            mustHave: state.check?.mustHave ?? [],
            niceToHave: state.check?.niceToHave ?? [],
            listings: listings.map((listing) => ({
              listingId: listing.listingId,
              title: listing.title,
              brand: listing.brand,
              modelNumber: listing.modelNumber,
              specifications: listing.specifications,
            })),
          },
          null,
          2
        )
      ),
    ]);

    for (const assessment of response.assessments) {
      assessments.set(assessment.listingId, assessment);
    }
  } catch (error) {
    console.warn("Procurement listing assessment failed, using keyword overlap:", error);
  }

  for (const listing of listings) {
    if (!assessments.has(listing.listingId)) {
      assessments.set(listing.listingId, keywordAssessment(state, listing));
    }
  }
  return assessments;
}

function keywordAssessment(state: ProcureState, listing: SupplierListing): Assessment {
  const wanted = uniqueText([...(state.check?.mustHave ?? []), state.requirement.name]);
  const haystack = normalize(
    [listing.title, listing.brand, listing.modelNumber, ...Object.values(listing.specifications)].join(" ")
  );
  const matched = wanted.filter((term) => normalize(term).split(" ").every((token) => haystack.includes(token)));
  return {
    listingId: listing.listingId,
    specMatch: wanted.length ? Math.min(0.8, matched.length / wanted.length) : 0.5,
    matched,
    conflicts: wanted.filter((term) => !matched.includes(term)).map((term) => `Doesn't mention ${term}`),
  };
}

function listingUnitPrice(listing: SupplierListing): number | null {
  if (listing.price == null || listing.unitsPerPriceUnit == null || listing.unitsPerPriceUnit <= 0) return null;
  return Math.round((listing.price / listing.unitsPerPriceUnit) * 100) / 100;
}

function dedupeKey(listing: SupplierListing): string {
  return `${listing.supplier.id}|${normalize(listing.title)}`;
}

const rankSuppliers: GraphNode<typeof State> = async (state) => {
  console.log("NODE: Rank Suppliers");

  const filteredOut = new Map<string, number>();
  const reject = (reason: string) => filteredOut.set(reason, (filteredOut.get(reason) ?? 0) + 1);

  const deduped = new Map<string, SupplierListing>();
  for (const listing of state.listings) {
    const key = dedupeKey(listing);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, listing);
      continue;
    }
    reject("Duplicate listing from the same seller");
    const existingPrice = listingUnitPrice(existing);
    const nextPrice = listingUnitPrice(listing);
    if (nextPrice != null && (existingPrice == null || nextPrice < existingPrice)) deduped.set(key, listing);
  }

  const eligible = [...deduped.values()].filter((listing) => {
    if (state.settings.requireGstRegistered && !listing.supplier.gstNumber) {
      reject("No GST number");
      return false;
    }
    if (state.settings.requireVerifiedSupplier && !listing.supplier.verifiedSupplier) {
      reject("Not a verified supplier");
      return false;
    }
    return true;
  });

  const assessed = eligible.slice(0, MAX_ASSESSED_LISTINGS);
  if (eligible.length > assessed.length) {
    filteredOut.set("Beyond the assessment limit", eligible.length - assessed.length);
  }

  const assessments = await assessListings(state, assessed);
  const matching = assessed.filter((listing) => {
    if ((assessments.get(listing.listingId)?.specMatch ?? 0) < MIN_SPEC_MATCH) {
      reject("Doesn't match the requested item");
      return false;
    }
    return true;
  });

  const prices = matching.map(listingUnitPrice).filter((price): price is number => price != null && price > 0);
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const preferredStates = new Set(state.settings.preferredStates.map(normalize));
  const customer = inferState(state.customerLocation);
  const quantity = state.requirement.quantity;

  const scored = matching.map((listing) => {
    const assessment = assessments.get(listing.listingId)!;
    const { supplier } = listing;
    const unitPrice = listingUnitPrice(listing);
    const reasons: string[] = assessment.matched.slice(0, 2).map((item) => `Matches ${item}`);
    const warnings: string[] = assessment.conflicts.slice(0, 3);

    const priceScore = unitPrice != null && lowestPrice != null ? lowestPrice / unitPrice : 0.3;
    if (unitPrice != null && unitPrice === lowestPrice && prices.length > 1) reasons.push("Lowest unit price");
    if (listing.price == null) warnings.push("Price on request");
    else if (unitPrice == null) warnings.push(`Priced per ${listing.priceUnit ?? "unit"}, pack size not stated`);

    let locationScore = preferredStates.size || customer.state ? 0.3 : 0.5;
    const sameCity = customer.city != null && normalize(supplier.city).includes(customer.city);
    const sameState = customer.state != null && normalize(supplier.state) === normalize(customer.state);
    if (preferredStates.has(normalize(supplier.state))) {
      locationScore = 1;
      reasons.push(`In ${supplier.state}, a preferred state`);
    } else if (sameCity) {
      locationScore = 0.9;
      reasons.push("Same city as the customer");
    } else if (sameState) {
      locationScore = 0.8;
      reasons.push("Same state as the customer");
    }

    const trustScore =
      (supplier.gstVerified ? 0.35 : 0) +
      (supplier.verifiedSupplier ? 0.25 : 0) +
      Math.min((supplier.yearsInBusiness ?? 0) / 10, 1) * 0.2 +
      (supplier.responseRate ?? 0) * 0.2;
    if (supplier.gstVerified) reasons.push("GST verified");
    else if (supplier.gstNumber) warnings.push("GST number not verified");
    else warnings.push("No GST number listed");
    if (supplier.verifiedSupplier) {
      reasons.push(
        supplier.yearsInBusiness ? `Verified supplier, ${supplier.yearsInBusiness} years in business` : "Verified supplier"
      );
    }

    const moqTooHigh = listing.minOrderQuantity != null && listing.minOrderQuantity > quantity;
    if (moqTooHigh) {
      warnings.push(
        `Minimum order ${formatQuantity(listing.minOrderQuantity!, listing.minOrderUnit)}, ${quantity} needed`
      );
    }

    const breakdown = {
      specMatch: round(assessment.specMatch),
      price: round(priceScore),
      location: round(locationScore),
      trust: round(trustScore),
    };
    const weighted =
      breakdown.specMatch * SCORE_WEIGHTS.specMatch +
      breakdown.price * SCORE_WEIGHTS.price +
      breakdown.location * SCORE_WEIGHTS.location +
      breakdown.trust * SCORE_WEIGHTS.trust;

    return {
      id: listing.listingId,
      rank: 0,
      listing,
      unitPrice,
      score: Math.round(weighted * (moqTooHigh ? MOQ_PENALTY : 1) * 100),
      scoreBreakdown: breakdown,
      reasons,
      warnings,
    } satisfies IProcurementCandidate;
  });

  scored.sort((left, right) => right.score - left.score || (left.unitPrice ?? Infinity) - (right.unitPrice ?? Infinity));
  if (scored.length > MAX_CANDIDATES) {
    filteredOut.set("Ranked below the top 10", scored.length - MAX_CANDIDATES);
  }
  const candidates = scored.slice(0, MAX_CANDIDATES).map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  return {
    candidates,
    summary: {
      listingsFound: state.listings.length,
      uniqueSuppliers: new Set(state.listings.map((listing) => listing.supplier.id)).size,
      filteredOut: [...filteredOut.entries()].map(([reason, count]) => ({ reason, count })),
    },
  };
};

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

const graph = new StateGraph(State)
  .addNode("checkRequirements", checkRequirements)
  .addNode("searchSuppliers", searchSuppliers)
  .addNode("rankSuppliers", rankSuppliers)
  .addEdge(START, "checkRequirements")
  .addConditionalEdges("checkRequirements", routeAfterCheck, ["searchSuppliers", END])
  .addEdge("searchSuppliers", "rankSuppliers")
  .addEdge("rankSuppliers", END)
  .compile();

export interface ProcurementAgentInput {
  organizationId: string;
  organization: { name: string; description: string };
  settings: z.infer<typeof settingsSchema>;
  requirement: IProcurementRequirement;
  customerLocation: string | null;
  searchAnyway: boolean;
}

export interface ProcurementAgentOutput {
  check: IProcurementCheck;
  candidates: IProcurementCandidate[];
  summary: IProcurementSummary | null;
  debug: IProcurementDebug;
}

export async function runProcurementAgent(input: ProcurementAgentInput): Promise<ProcurementAgentOutput> {
  const result = await graph.invoke({
    ...input,
    check: null,
    listings: [],
    queryLog: [],
    candidates: [],
    summary: null,
  });

  if (!result.check) throw new Error("Procurement check did not produce a decision");

  return {
    check: result.check,
    candidates: result.candidates ?? [],
    summary: result.summary ?? null,
    debug: { queries: result.queryLog ?? [], model: MODEL_NAME },
  };
}
