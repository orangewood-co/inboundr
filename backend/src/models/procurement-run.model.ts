import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { SupplierListing } from "../procurement/supplier-search.types";

export const PROCUREMENT_RUN_STATUSES = ["queued", "processing", "succeeded", "failed"] as const;
export type ProcurementRunStatus = (typeof PROCUREMENT_RUN_STATUSES)[number];

export const PROCUREMENT_CHECK_DECISIONS = ["proceed", "needs_clarification", "out_of_scope"] as const;
export type ProcurementCheckDecision = (typeof PROCUREMENT_CHECK_DECISIONS)[number];

export interface IProcurementRequirement {
  name: string;
  quantity: number;
  code: string | null;
  manufacturer: string | null;
  specifications: Record<string, string>;
  /** Extra detail typed by the user when refining a search. */
  notes: string | null;
}

export interface IProcurementCheck {
  decision: ProcurementCheckDecision;
  reason: string;
  productType: string | null;
  missingInformation: string[];
  searchQueries: string[];
  mustHave: string[];
  niceToHave: string[];
}

export interface IProcurementScoreBreakdown {
  specMatch: number;
  price: number;
  location: number;
  trust: number;
}

export interface IProcurementCandidate {
  id: string;
  rank: number;
  listing: SupplierListing;
  /** Listed price converted to one requested unit. Null when the price or pack size is unknown. */
  unitPrice: number | null;
  score: number;
  scoreBreakdown: IProcurementScoreBreakdown;
  reasons: string[];
  warnings: string[];
}

export interface IProcurementSummary {
  listingsFound: number;
  uniqueSuppliers: number;
  filteredOut: Array<{ reason: string; count: number }>;
}

export interface IProcurementDebug {
  queries: Array<{ query: string; resultCount: number; fromCache: boolean }>;
  model: string | null;
}

export interface IProcurementRun extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  rfqId: Types.ObjectId;
  searchResultIndex: number;
  requestedByUserId: string;
  requirement: IProcurementRequirement;
  requirementKey: string;
  customerLocation: string | null;
  searchAnyway: boolean;
  provider: string;
  status: ProcurementRunStatus;
  check: IProcurementCheck | null;
  candidates: IProcurementCandidate[];
  summary: IProcurementSummary | null;
  debug: IProcurementDebug | null;
  selectedCandidateId: string | null;
  selectedAt: Date | null;
  selectedByUserId: string | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const procurementCandidateSchema = new Schema<IProcurementCandidate>(
  {
    id: { type: String, required: true },
    rank: { type: Number, required: true },
    listing: { type: Schema.Types.Mixed, required: true },
    unitPrice: { type: Number, default: null },
    score: { type: Number, required: true },
    scoreBreakdown: {
      specMatch: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      trust: { type: Number, default: 0 },
    },
    reasons: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

const procurementRunSchema = new Schema<IProcurementRun>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    rfqId: { type: Schema.Types.ObjectId, ref: "RFQ", required: true },
    searchResultIndex: { type: Number, required: true, min: 0 },
    requestedByUserId: { type: String, required: true },
    requirement: {
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      code: { type: String, default: null },
      manufacturer: { type: String, default: null },
      specifications: { type: Schema.Types.Mixed, default: () => ({}) },
      notes: { type: String, default: null, maxlength: 1000 },
    },
    // Identifies the requested line by content, since RFQ reprocessing can shift searchResultIndex.
    requirementKey: { type: String, required: true },
    customerLocation: { type: String, default: null },
    searchAnyway: { type: Boolean, default: false },
    provider: { type: String, required: true },
    status: { type: String, enum: PROCUREMENT_RUN_STATUSES, default: "queued", index: true },
    check: {
      type: {
        decision: { type: String, enum: PROCUREMENT_CHECK_DECISIONS, required: true },
        reason: { type: String, default: "" },
        productType: { type: String, default: null },
        missingInformation: { type: [String], default: [] },
        searchQueries: { type: [String], default: [] },
        mustHave: { type: [String], default: [] },
        niceToHave: { type: [String], default: [] },
      },
      default: null,
      _id: false,
    },
    candidates: { type: [procurementCandidateSchema], default: [] },
    summary: {
      type: {
        listingsFound: { type: Number, default: 0 },
        uniqueSuppliers: { type: Number, default: 0 },
        filteredOut: {
          type: [{ reason: { type: String, required: true }, count: { type: Number, required: true } }],
          default: [],
          _id: false,
        },
      },
      default: null,
      _id: false,
    },
    debug: { type: Schema.Types.Mixed, default: null },
    selectedCandidateId: { type: String, default: null },
    selectedAt: { type: Date, default: null },
    selectedByUserId: { type: String, default: null },
    error: { type: String, default: null, maxlength: 5000 },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 2, min: 1, max: 5 },
    availableAt: { type: Date, default: Date.now },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

procurementRunSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
procurementRunSchema.index({ organizationId: 1, rfqId: 1, createdAt: -1 });
procurementRunSchema.index({ organizationId: 1, rfqId: 1, requirementKey: 1, createdAt: -1 });

export const ProcurementRun = mongoose.model<IProcurementRun>("ProcurementRun", procurementRunSchema);
