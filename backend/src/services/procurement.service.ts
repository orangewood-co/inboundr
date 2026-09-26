import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { RFQ, type IRFQ } from "../models/rfq.model";
import { Organization } from "../models/organization.model";
import {
  ProcurementRun,
  type IProcurementRequirement,
  type IProcurementRun,
} from "../models/procurement-run.model";
import { ProcurementSettings, type IProcurementSettings } from "../models/procurement-settings.model";
import { runProcurementAgent } from "../agents/procure";
import { getSupplierSearchProvider } from "../procurement/supplier-search";

const WORKER_ID = `procurement-${process.pid}-${randomUUID().slice(0, 8)}`;
const LOCK_MS = 5 * 60_000;
const RETRY_DELAY_MS = 15_000;

export class ProcurementServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

type RFQLine = Pick<IRFQ, "queryProducts" | "searchResults">;

function objectId(value: unknown, label: string): Types.ObjectId {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new ProcurementServiceError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = nullableText(item, maxLength);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function specificationsObject(value: unknown): Record<string, string> {
  const entries = value instanceof Map ? [...value.entries()] : Object.entries((value as object | null) ?? {});
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "")
  );
}

// ---------------------------------------------------------------------------
// Settings

export async function getOrCreateProcurementSettings(organizationId: Types.ObjectId) {
  return ProcurementSettings.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { organizationId } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
}

export function serializeProcurementSettings(settings: IProcurementSettings) {
  return {
    instructions: settings.instructions,
    preferredStates: settings.preferredStates,
    excludedKeywords: settings.excludedKeywords,
    requireGstRegistered: settings.requireGstRegistered,
    requireVerifiedSupplier: settings.requireVerifiedSupplier,
    defaultMarginPercent: settings.defaultMarginPercent,
    updatedAt: settings.updatedAt,
  };
}

export async function updateProcurementSettings(
  organizationId: Types.ObjectId,
  body: Record<string, unknown>,
  userId: string
) {
  const settings = await getOrCreateProcurementSettings(organizationId);
  if ("instructions" in body) settings.instructions = nullableText(body.instructions, 4000) ?? "";
  if ("preferredStates" in body) settings.preferredStates = stringList(body.preferredStates, 40, 60);
  if ("excludedKeywords" in body) settings.excludedKeywords = stringList(body.excludedKeywords, 50, 80);
  if (typeof body.requireGstRegistered === "boolean") settings.requireGstRegistered = body.requireGstRegistered;
  if (typeof body.requireVerifiedSupplier === "boolean") settings.requireVerifiedSupplier = body.requireVerifiedSupplier;
  if ("defaultMarginPercent" in body) {
    const margin = Number(body.defaultMarginPercent);
    if (!Number.isFinite(margin) || margin < 0 || margin > 500) {
      throw new ProcurementServiceError("Default margin must be between 0 and 500 percent", 400);
    }
    settings.defaultMarginPercent = margin;
  }
  settings.updatedBy = userId;
  await settings.save();
  return settings;
}

// ---------------------------------------------------------------------------
// Runs

function buildRequirement(rfq: RFQLine, index: number): Omit<IProcurementRequirement, "notes"> | null {
  const searchResult = rfq.searchResults[index];
  if (!searchResult) return null;
  // queryProducts and searchResults are produced in the same order, but only queryProducts keeps code/specs.
  const product = rfq.queryProducts[index];
  const sameLine = product && product.name.trim().toLowerCase() === searchResult.query.name.trim().toLowerCase();
  return {
    name: searchResult.query.name,
    quantity: searchResult.query.quantity,
    code: sameLine ? product.code ?? null : null,
    manufacturer: sameLine ? product.manufacturer ?? null : null,
    specifications: sameLine ? specificationsObject(product.specifications) : {},
  };
}

function requirementKeyFor(requirement: Omit<IProcurementRequirement, "notes">): string {
  const normalize = (value: string | null) => (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const specifications = Object.entries(requirement.specifications)
    .map(([key, value]) => `${normalize(key)}=${normalize(value)}`)
    .sort();
  return createHash("sha1")
    .update(
      JSON.stringify([
        normalize(requirement.name),
        requirement.quantity,
        normalize(requirement.code),
        normalize(requirement.manufacturer),
        specifications,
      ])
    )
    .digest("hex");
}

type RunRecord = Pick<
  IProcurementRun,
  | "_id"
  | "rfqId"
  | "searchResultIndex"
  | "status"
  | "requirement"
  | "searchAnyway"
  | "provider"
  | "check"
  | "candidates"
  | "summary"
  | "debug"
  | "selectedCandidateId"
  | "selectedAt"
  | "error"
  | "attempts"
  | "createdAt"
  | "startedAt"
  | "completedAt"
>;

function serializeRun(run: RunRecord, lineIndex?: number) {
  return {
    id: String(run._id),
    rfqId: String(run.rfqId),
    searchResultIndex: run.searchResultIndex,
    lineIndex: lineIndex ?? run.searchResultIndex,
    status: run.status,
    requirement: run.requirement,
    searchAnyway: run.searchAnyway,
    provider: run.provider,
    check: run.check,
    candidates: run.candidates,
    summary: run.summary,
    queries: run.debug?.queries ?? [],
    selectedCandidateId: run.selectedCandidateId,
    selectedAt: run.selectedAt,
    error: run.error,
    attempts: run.attempts,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  };
}

export type SerializedProcurementRun = ReturnType<typeof serializeRun>;

async function findAccessibleRFQ(organizationId: Types.ObjectId, userId: string, rfqId: Types.ObjectId) {
  const rfq = await RFQ.findOne({ _id: rfqId, userId, organizationId })
    .select("isProcessed customer queryProducts searchResults")
    .lean();
  if (!rfq) throw new ProcurementServiceError("RFQ not found", 404);
  return rfq;
}

export async function requestProcurementRun(input: {
  organizationId: Types.ObjectId;
  userId: string;
  rfqId: unknown;
  searchResultIndex: unknown;
  notes?: unknown;
  searchAnyway?: unknown;
  force?: unknown;
}): Promise<SerializedProcurementRun> {
  const rfqId = objectId(input.rfqId, "RFQ id");
  const index = Number(input.searchResultIndex);
  if (!Number.isInteger(index) || index < 0) {
    throw new ProcurementServiceError("A valid line index is required", 400);
  }

  const rfq = await findAccessibleRFQ(input.organizationId, input.userId, rfqId);
  if (!rfq.isProcessed) throw new ProcurementServiceError("This RFQ is still being processed", 409);

  const baseRequirement = buildRequirement(rfq, index);
  if (!baseRequirement) throw new ProcurementServiceError("That line no longer exists on this RFQ", 404);

  const requirementKey = requirementKeyFor(baseRequirement);
  const scope = { organizationId: input.organizationId, rfqId, requirementKey };

  const active = await ProcurementRun.findOne({ ...scope, status: { $in: ["queued", "processing"] } })
    .sort({ createdAt: -1 })
    .lean();
  if (active) return serializeRun(active, index);

  if (input.force !== true) {
    const latest = await ProcurementRun.findOne({ ...scope, status: "succeeded" }).sort({ createdAt: -1 }).lean();
    if (latest) return serializeRun(latest, index);
  }

  const run = await ProcurementRun.create({
    organizationId: input.organizationId,
    rfqId,
    searchResultIndex: index,
    requestedByUserId: input.userId,
    requirement: { ...baseRequirement, notes: nullableText(input.notes, 1000) },
    requirementKey,
    customerLocation: rfq.customer?.address ?? null,
    searchAnyway: input.searchAnyway === true,
    provider: getSupplierSearchProvider().label,
    status: "queued",
    availableAt: new Date(),
    maxAttempts: Math.min(5, Math.max(1, Number(process.env.PROCUREMENT_MAX_ATTEMPTS) || 2)),
  });

  kickProcurementWorker();
  return serializeRun(run.toObject(), index);
}

export async function listProcurementRuns(input: {
  organizationId: Types.ObjectId;
  userId: string;
  rfqId: unknown;
}): Promise<SerializedProcurementRun[]> {
  const rfqId = objectId(input.rfqId, "RFQ id");
  const rfq = await findAccessibleRFQ(input.organizationId, input.userId, rfqId);

  const keysByLine = rfq.searchResults.map((_result, index) => {
    const requirement = buildRequirement(rfq, index);
    return requirement ? requirementKeyFor(requirement) : null;
  });
  const runs = await ProcurementRun.find({
    organizationId: input.organizationId,
    rfqId,
    requirementKey: { $in: keysByLine.filter((key): key is string => key != null) },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // Match runs to lines by requirement, not stored index, so they follow a line when reprocessing reorders it.
  const latest: SerializedProcurementRun[] = [];
  keysByLine.forEach((key, lineIndex) => {
    const run = key ? runs.find((candidate) => candidate.requirementKey === key) : undefined;
    if (run) latest.push(serializeRun(run, lineIndex));
  });
  return latest;
}

async function findAccessibleRun(organizationId: Types.ObjectId, userId: string, runIdValue: unknown) {
  const runId = objectId(runIdValue, "procurement run id");
  const run = await ProcurementRun.findOne({ _id: runId, organizationId });
  if (!run) throw new ProcurementServiceError("Procurement run not found", 404);
  await findAccessibleRFQ(organizationId, userId, run.rfqId);
  return run;
}

export async function getProcurementRun(input: {
  organizationId: Types.ObjectId;
  userId: string;
  runId: unknown;
}): Promise<SerializedProcurementRun> {
  const run = await findAccessibleRun(input.organizationId, input.userId, input.runId);
  return serializeRun(run.toObject());
}

export async function selectProcurementCandidate(input: {
  organizationId: Types.ObjectId;
  userId: string;
  runId: unknown;
  candidateId: unknown;
}): Promise<SerializedProcurementRun> {
  const run = await findAccessibleRun(input.organizationId, input.userId, input.runId);
  if (run.status !== "succeeded") throw new ProcurementServiceError("This search hasn't finished yet", 409);
  const candidate = run.candidates.find((item) => item.id === input.candidateId);
  if (!candidate) throw new ProcurementServiceError("Supplier not found in this search", 404);

  run.selectedCandidateId = candidate.id;
  run.selectedAt = new Date();
  run.selectedByUserId = input.userId;
  await run.save();
  return serializeRun(run.toObject());
}

// ---------------------------------------------------------------------------
// Worker

async function recoverStaleRuns() {
  await ProcurementRun.updateMany(
    { status: "processing", lockedAt: { $lt: new Date(Date.now() - LOCK_MS) } },
    {
      $set: {
        status: "queued",
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        error: "Recovered stale processing lock",
      },
    }
  );
}

async function claimNextRun() {
  const now = new Date();
  return ProcurementRun.findOneAndUpdate(
    { status: "queued", availableAt: { $lte: now } },
    {
      $set: { status: "processing", lockedAt: now, lockedBy: WORKER_ID, startedAt: now, error: null },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { availableAt: 1, createdAt: 1 } }
  );
}

async function executeRun(run: IProcurementRun) {
  try {
    const record = run.toObject();
    const [organization, settings] = await Promise.all([
      Organization.findById(run.organizationId).select("name description").lean(),
      getOrCreateProcurementSettings(run.organizationId),
    ]);
    if (!organization) throw new Error("Organization no longer exists");

    const output = await runProcurementAgent({
      organizationId: String(run.organizationId),
      organization: { name: organization.name, description: organization.description ?? "" },
      settings: {
        instructions: settings.instructions,
        preferredStates: settings.preferredStates,
        excludedKeywords: settings.excludedKeywords,
        requireGstRegistered: settings.requireGstRegistered,
        requireVerifiedSupplier: settings.requireVerifiedSupplier,
      },
      requirement: {
        name: record.requirement.name,
        quantity: record.requirement.quantity,
        code: record.requirement.code ?? null,
        manufacturer: record.requirement.manufacturer ?? null,
        specifications: specificationsObject(record.requirement.specifications),
        notes: record.requirement.notes ?? null,
      },
      customerLocation: record.customerLocation,
      searchAnyway: record.searchAnyway,
    });

    await ProcurementRun.updateOne(
      { _id: run._id, lockedBy: WORKER_ID },
      {
        $set: {
          status: "succeeded",
          check: output.check,
          candidates: output.candidates,
          summary: output.summary,
          debug: output.debug,
          error: null,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      }
    );
  } catch (error) {
    console.error("Procurement run failed:", error);
    const message = (error instanceof Error ? error.message : "Procurement search failed").slice(0, 5000);
    const retry = run.attempts < run.maxAttempts;
    await ProcurementRun.updateOne(
      { _id: run._id, lockedBy: WORKER_ID },
      {
        $set: {
          status: retry ? "queued" : "failed",
          error: message,
          lockedAt: null,
          lockedBy: null,
          ...(retry
            ? { availableAt: new Date(Date.now() + RETRY_DELAY_MS * run.attempts) }
            : { completedAt: new Date() }),
        },
      }
    );
  }
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let claiming = false;
let inFlight = 0;

function maxConcurrency(): number {
  return Math.min(10, Math.max(1, Number(process.env.PROCUREMENT_WORKER_CONCURRENCY) || 3));
}

async function tick() {
  if (claiming) return;
  claiming = true;
  try {
    await recoverStaleRuns();
    while (inFlight < maxConcurrency()) {
      const run = await claimNextRun();
      if (!run) break;
      inFlight += 1;
      void executeRun(run).finally(() => {
        inFlight -= 1;
        void tick();
      });
    }
  } catch (error) {
    console.error("Procurement worker failed:", error);
  } finally {
    claiming = false;
  }
}

function kickProcurementWorker() {
  if (!workerTimer) return;
  void tick();
}

export function startProcurementWorker() {
  if (workerTimer || process.env.PROCUREMENT_WORKER_ENABLED === "false") return;
  workerTimer = setInterval(tick, Math.max(2_000, Number(process.env.PROCUREMENT_POLL_MS) || 5_000));
  workerTimer.unref();
  void tick();
}
