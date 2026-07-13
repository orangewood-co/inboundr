import crypto from "node:crypto";
import type { Types } from "mongoose";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import {
  generateRecruitmentRubric,
  rankApplication,
  rubricSchema,
  type RecruitmentRubricInput,
} from "../agents/rank_application";
import { RecruitmentApplication } from "../models/recruitment-application.model";
import { RecruitmentAttachment } from "../models/recruitment-attachment.model";
import { RecruitmentJob } from "../models/recruitment-job.model";
import { RecruitmentRankingJob } from "../models/recruitment-ranking-job.model";
import { RecruitmentRubric } from "../models/recruitment-rubric.model";
import { getObjectBuffer } from "./storage.service";

interface RecruitmentActor {
  userId: string;
  name: string;
}

class RecruitmentRankingServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

const WORKER_ID = `${process.pid}-${crypto.randomUUID()}`;
const MAX_BYTES = Math.min(
  10 * 1024 * 1024,
  Math.max(256 * 1024, Number(process.env.RECRUITMENT_RESUME_MAX_BYTES) || 8 * 1024 * 1024)
);
const MAX_TEXT = Math.min(
  100_000,
  Math.max(5_000, Number(process.env.RECRUITMENT_RESUME_MAX_TEXT_CHARS) || 40_000)
);
const PARSE_TIMEOUT_MS = Math.max(
  2_000,
  Number(process.env.RECRUITMENT_RESUME_PARSE_TIMEOUT_MS) || 15_000
);
const LOCK_MS = Math.max(30_000, Number(process.env.RECRUITMENT_RANKING_LOCK_MS) || 5 * 60_000);
const PROTECTED_SIGNAL =
  /\b(age|aged|birth|born|dob|date of birth|gender|sex|male|female|marital|married|single|race|racial|ethnic|ethnicity|religion|religious|caste|disability|disabled|pregnan|nationality|citizenship|sexual orientation|pronouns?)\b/i;

class ManualReviewError extends Error {}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new ManualReviewError(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

export function redactRecruitmentText(
  value: string,
  identity: { name?: string; email?: string } = {}
): string {
  let result = value.normalize("NFKC");
  for (const exact of [identity.name, identity.email].map(text).filter(Boolean)) {
    result = result.replace(
      new RegExp(exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      "[REDACTED]"
    );
  }
  result = result
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:https?:\/\/|www\.)\S+\b/gi, "[REDACTED_URL]")
    .replace(/\b(?:linkedin\.com|github\.com)\/\S+\b/gi, "[REDACTED_URL]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[REDACTED_PHONE]")
    .replace(
      /^.*\b(?:street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|boulevard|blvd\.|sector|postcode|postal|zip)\b.*$/gim,
      "[REDACTED_ADDRESS]"
    );
  return result
    .split(/\r?\n/)
    .map((line) => (PROTECTED_SIGNAL.test(line) ? "[REDACTED_PROTECTED_SIGNAL]" : line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_TEXT);
}

async function extractResume(attachment: {
  key: string;
  size: number;
  contentType: string;
}) {
  if (attachment.size <= 0 || attachment.size > MAX_BYTES) {
    throw new ManualReviewError("Resume exceeds the ranking byte limit");
  }
  const data = await timeout(getObjectBuffer(attachment.key), PARSE_TIMEOUT_MS, "Resume download timed out");
  if (data.byteLength > MAX_BYTES) throw new ManualReviewError("Resume exceeds the ranking byte limit");

  let extracted = "";
  if (attachment.contentType === "application/pdf") {
    const parser = new PDFParse({ data });
    try {
      extracted = (
        await timeout(parser.getText(), PARSE_TIMEOUT_MS, "PDF parsing timed out")
      ).text;
    } catch (error) {
      if (error instanceof ManualReviewError) throw error;
      throw new ManualReviewError("PDF could not be read");
    } finally {
      await parser.destroy();
    }
  } else if (
    attachment.contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      extracted = (
        await timeout(mammoth.extractRawText({ buffer: data }), PARSE_TIMEOUT_MS, "DOCX parsing timed out")
      ).value;
    } catch (error) {
      if (error instanceof ManualReviewError) throw error;
      throw new ManualReviewError("DOCX could not be read");
    }
  } else {
    throw new ManualReviewError("Resume format is not supported for ranking");
  }
  extracted = extracted.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim().slice(0, MAX_TEXT);
  if (extracted.length < 80) {
    throw new ManualReviewError("Resume is unreadable or image-only");
  }
  return extracted;
}

function allowedAnswers(application: any) {
  const fields = Array.isArray(application.formSchemaSnapshot?.fields)
    ? application.formSchemaSnapshot.fields
    : [];
  return fields.flatMap((field: any) => {
    const label = text(field.label);
    if (
      !label ||
      field.type === "file" ||
      field.type === "email" ||
      ["fullName", "email", "resume", "consent"].includes(field.id) ||
      PROTECTED_SIGNAL.test(label)
    ) {
      return [];
    }
    const raw = application.answers?.[field.id];
    if (raw == null || typeof raw === "object" && !Array.isArray(raw)) return [];
    const answer = (Array.isArray(raw) ? raw.map(text).join(", ") : text(raw)).slice(0, 3000);
    return answer ? [{ question: label.slice(0, 300), answer }] : [];
  });
}

function validateRubric(value: unknown): RecruitmentRubricInput {
  const rubric = rubricSchema.parse(value);
  const ids = new Set(rubric.criteria.map((criterion) => criterion.id));
  const total = rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (ids.size !== rubric.criteria.length) {
    throw new RecruitmentRankingServiceError("Rubric criterion ids must be unique");
  }
  if (Math.abs(total - 100) > 0.01) {
    throw new RecruitmentRankingServiceError("Rubric criterion weights must total 100");
  }
  if (
    rubric.criteria.some((criterion) =>
      PROTECTED_SIGNAL.test(`${criterion.name} ${criterion.description}`)
    )
  ) {
    throw new RecruitmentRankingServiceError(
      "Rubric criteria cannot use protected-trait signals"
    );
  }
  return rubric;
}

async function nextRubricVersion(organizationId: Types.ObjectId, jobId: Types.ObjectId) {
  const latest = await RecruitmentRubric.findOne({ organizationId, jobId })
    .sort({ version: -1 })
    .select("version")
    .lean();
  return (latest?.version ?? 0) + 1;
}

export async function generateRubricDraft(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  actor: RecruitmentActor
) {
  const job = await RecruitmentJob.findOne({ _id: jobId, organizationId }).lean();
  if (!job) throw new RecruitmentRankingServiceError("Job not found", 404);
  const generated = await generateRecruitmentRubric({
    jobTitle: job.title,
    jobDescription: redactRecruitmentText(job.description),
    jobRequirements: redactRecruitmentText(job.requirements),
  });
  const validated = validateRubric(generated);
  return RecruitmentRubric.create({
    organizationId,
    jobId,
    version: await nextRubricVersion(organizationId, jobId),
    status: "draft",
    criteria: validated.criteria,
    instructions: validated.instructions,
    modelName: generated.model,
    promptVersion: generated.promptVersion,
    generatedAt: new Date(),
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
  });
}

export async function ensureRubricDraft(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  actor: RecruitmentActor
) {
  return (
    (await RecruitmentRubric.findOne({ organizationId, jobId, status: "draft" }).sort({
      version: -1,
    })) ?? (await generateRubricDraft(organizationId, jobId, actor))
  );
}

export async function getJobRubrics(organizationId: Types.ObjectId, jobId: Types.ObjectId) {
  if (!(await RecruitmentJob.exists({ _id: jobId, organizationId }))) {
    throw new RecruitmentRankingServiceError("Job not found", 404);
  }
  const items = await RecruitmentRubric.find({ organizationId, jobId }).sort({ version: -1 }).lean();
  return {
    items,
    draft: items.find((item) => item.status === "draft") ?? null,
    approved: items.find((item) => item.status === "approved") ?? null,
  };
}

export async function updateRubricDraft(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  rubricId: Types.ObjectId,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const input = validateRubric({ criteria: body.criteria, instructions: text(body.instructions) });
  const rubric = await RecruitmentRubric.findOneAndUpdate(
    { _id: rubricId, organizationId, jobId, status: "draft" },
    { $set: { ...input, updatedByUserId: actor.userId } },
    { new: true, runValidators: true }
  );
  if (!rubric) throw new RecruitmentRankingServiceError("Editable rubric draft not found", 404);
  return rubric;
}

export async function approveRubric(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  rubricId: Types.ObjectId,
  actor: RecruitmentActor,
  enqueueActive: boolean
) {
  const draft = await RecruitmentRubric.findOne({ _id: rubricId, organizationId, jobId, status: "draft" });
  if (!draft) throw new RecruitmentRankingServiceError("Rubric draft not found", 404);
  validateRubric({ criteria: draft.criteria, instructions: draft.instructions });
  await RecruitmentRubric.updateMany(
    { organizationId, jobId, status: "approved" },
    { $set: { status: "superseded" } }
  );
  draft.status = "approved";
  draft.approvedAt = new Date();
  draft.approvedByUserId = actor.userId;
  draft.updatedByUserId = actor.userId;
  await draft.save();
  const batch = enqueueActive
    ? await enqueueActiveApplications(organizationId, jobId, actor.userId, true)
    : null;
  return { rubric: draft, batch };
}

export async function regenerateRubric(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  actor: RecruitmentActor,
  approveAndEnqueueActive: boolean
) {
  await RecruitmentRubric.updateMany(
    { organizationId, jobId, status: "draft" },
    { $set: { status: "superseded" } }
  );
  const rubric = await generateRubricDraft(organizationId, jobId, actor);
  if (!approveAndEnqueueActive) return { rubric, batch: null };
  return approveRubric(organizationId, jobId, rubric._id, actor, true);
}

export async function enqueueApplicationRanking(input: {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  inputRevision: number;
  requestedByUserId?: string | null;
  force?: boolean;
  batchId?: string | null;
}) {
  const rubric = await RecruitmentRubric.findOne({
    organizationId: input.organizationId,
    jobId: input.jobId,
    status: "approved",
  })
    .sort({ version: -1 })
    .lean();
  if (!rubric) return null;
  if (!input.force) {
    const existing = await RecruitmentRankingJob.findOne({
      applicationId: input.applicationId,
      inputRevision: input.inputRevision,
      rubricVersion: rubric.version,
      status: { $in: ["queued", "processing", "succeeded", "manual_review"] },
    }).sort({ createdAt: -1 });
    if (existing) return existing;
  }
  const queueJob = await RecruitmentRankingJob.create({
    organizationId: input.organizationId,
    jobId: input.jobId,
    applicationId: input.applicationId,
    inputRevision: input.inputRevision,
    rubricVersion: rubric.version,
    batchId: input.batchId ?? null,
    provider: "openrouter",
    status: "queued",
    requestedByUserId: input.requestedByUserId ?? null,
    availableAt: new Date(),
    maxAttempts: Math.min(10, Math.max(1, Number(process.env.RECRUITMENT_RANKING_MAX_ATTEMPTS) || 3)),
  });
  await RecruitmentApplication.updateOne(
    { _id: input.applicationId, organizationId: input.organizationId },
    {
      $set: {
        ranking: {
          status: "queued",
          queueJobId: queueJob._id,
          inputRevision: input.inputRevision,
          rubricVersion: rubric.version,
          queuedAt: new Date(),
        },
      },
    }
  );
  return queueJob;
}

export async function enqueueActiveApplications(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  requestedByUserId: string,
  force = true
) {
  const batchId = crypto.randomUUID();
  const applications = await RecruitmentApplication.find({
    organizationId,
    jobId,
    status: "active",
  })
    .select("_id revision")
    .lean();
  let queued = 0;
  for (const application of applications) {
    if (
      await enqueueApplicationRanking({
        organizationId,
        jobId,
        applicationId: application._id,
        inputRevision: application.revision,
        requestedByUserId,
        force,
        batchId,
      })
    ) {
      queued += 1;
    }
  }
  return { batchId, total: applications.length, queued };
}

async function recoverStaleJobs() {
  const stale = new Date(Date.now() - LOCK_MS);
  await RecruitmentRankingJob.updateMany(
    { status: "processing", lockedAt: { $lt: stale } },
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

async function persistTerminal(queueJob: any, status: "succeeded" | "failed" | "manual_review", data: any) {
  const now = new Date();
  await RecruitmentRankingJob.updateOne(
    { _id: queueJob._id, lockedBy: WORKER_ID },
    {
      $set: {
        status,
        result: data.result ?? null,
        error: data.error ?? null,
        completedAt: now,
        lockedAt: null,
        lockedBy: null,
        ...(data.error ? { lastErrorAt: now } : {}),
      },
    }
  );
  await RecruitmentApplication.updateOne(
    {
      _id: queueJob.applicationId,
      organizationId: queueJob.organizationId,
    },
    {
      $set: {
        ranking: {
          status,
          queueJobId: queueJob._id,
          inputRevision: queueJob.inputRevision,
          rubricVersion: queueJob.rubricVersion,
          result: data.result ?? null,
          error: data.error ?? null,
          completedAt: now,
        },
      },
    }
  );
}

async function executeClaimed(queueJob: any) {
  try {
    const application = await RecruitmentApplication.findOne({
      _id: queueJob.applicationId,
      organizationId: queueJob.organizationId,
    }).lean();
    if (!application) throw new Error("Application no longer exists");
    if (application.revision !== queueJob.inputRevision) {
      throw new ManualReviewError("Application changed after this ranking job was queued");
    }
    const [job, rubric, attachment, candidate] = await Promise.all([
      RecruitmentJob.findOne({ _id: queueJob.jobId, organizationId: queueJob.organizationId }).lean(),
      RecruitmentRubric.findOne({
        organizationId: queueJob.organizationId,
        jobId: queueJob.jobId,
        version: queueJob.rubricVersion,
        status: { $in: ["approved", "superseded"] },
      }).lean(),
      RecruitmentAttachment.findOne({
        _id: application.resumeAttachmentId,
        organizationId: queueJob.organizationId,
      }).lean(),
      RecruitmentApplication.findById(application._id)
        .populate<{ candidateId: { fullName: string; email: string } }>("candidateId", "fullName email")
        .select("candidateId")
        .lean(),
    ]);
    if (!job || !rubric) throw new ManualReviewError("Approved rubric is unavailable");
    if (!attachment) throw new ManualReviewError("Resume attachment is unavailable");
    const identity =
      candidate && typeof candidate.candidateId === "object" ? candidate.candidateId : undefined;
    const resumeText = redactRecruitmentText(await extractResume(attachment), identity);
    const answers = allowedAnswers(application).map((item: { question: string; answer: string }) => ({
      question: item.question,
      answer: redactRecruitmentText(item.answer, identity),
    }));
    const result = await rankApplication({
      jobTitle: job.title,
      jobDescription: redactRecruitmentText(job.description),
      jobRequirements: redactRecruitmentText(job.requirements),
      rubric: { criteria: rubric.criteria, instructions: rubric.instructions },
      resumeText,
      applicationAnswers: answers,
    });
    await persistTerminal(queueJob, "succeeded", {
      result: {
        ...result,
        rubricVersion: rubric.version,
        rubricId: rubric._id,
        rankedAt: new Date(),
      },
    });
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Ranking failed").slice(0, 5000);
    if (error instanceof ManualReviewError) {
      await persistTerminal(queueJob, "manual_review", { error: message });
      return;
    }
    if (queueJob.attempts < queueJob.maxAttempts) {
      const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, queueJob.attempts - 1));
      await RecruitmentRankingJob.updateOne(
        { _id: queueJob._id, lockedBy: WORKER_ID },
        {
          $set: {
            status: "queued",
            error: message,
            lastErrorAt: new Date(),
            availableAt: new Date(Date.now() + delay),
            lockedAt: null,
            lockedBy: null,
          },
        }
      );
      await RecruitmentApplication.updateOne(
        {
          _id: queueJob.applicationId,
          organizationId: queueJob.organizationId,
        },
        {
          $set: {
            "ranking.status": "queued",
            "ranking.error": message,
            "ranking.retryAt": new Date(Date.now() + delay),
          },
        }
      );
      return;
    }
    await persistTerminal(queueJob, "failed", { error: message });
  }
}

export async function processNextRecruitmentRankingJob() {
  await recoverStaleJobs();
  const now = new Date();
  const claimed = await RecruitmentRankingJob.findOneAndUpdate(
    { status: "queued", availableAt: { $lte: now } },
    {
      $set: {
        status: "processing",
        lockedAt: now,
        lockedBy: WORKER_ID,
        startedAt: now,
        error: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { availableAt: 1, createdAt: 1 } }
  );
  if (!claimed) return null;
  await RecruitmentApplication.updateOne(
    {
      _id: claimed.applicationId,
      organizationId: claimed.organizationId,
    },
    {
      $set: {
        "ranking.status": "processing",
        "ranking.startedAt": now,
        "ranking.queueJobId": claimed._id,
      },
    }
  );
  await executeClaimed(claimed);
  return RecruitmentRankingJob.findById(claimed._id).lean();
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerBusy = false;

export function startRecruitmentRankingWorker() {
  if (workerTimer || process.env.RECRUITMENT_RANKING_WORKER_ENABLED === "false") return;
  const tick = async () => {
    if (workerBusy) return;
    workerBusy = true;
    try {
      await processNextRecruitmentRankingJob();
    } catch (error) {
      console.error("Recruitment ranking worker failed:", error);
    } finally {
      workerBusy = false;
    }
  };
  workerTimer = setInterval(
    tick,
    Math.max(2_000, Number(process.env.RECRUITMENT_RANKING_POLL_MS) || 10_000)
  );
  workerTimer.unref();
  void tick();
}

export async function retryApplicationRanking(
  organizationId: Types.ObjectId,
  applicationId: Types.ObjectId,
  requestedByUserId: string
) {
  const application = await RecruitmentApplication.findOne({ _id: applicationId, organizationId }).lean();
  if (!application) throw new RecruitmentRankingServiceError("Application not found", 404);
  const latest = await RecruitmentRankingJob.findOne({
    organizationId,
    applicationId,
    status: { $in: ["failed", "manual_review"] },
  }).sort({ createdAt: -1 });
  if (!latest) throw new RecruitmentRankingServiceError("No failed ranking is available to retry", 409);
  latest.status = "queued";
  latest.attempts = 0;
  latest.availableAt = new Date();
  latest.error = null;
  latest.completedAt = null;
  latest.lockedAt = null;
  latest.lockedBy = null;
  latest.requestedByUserId = requestedByUserId;
  await latest.save();
  await RecruitmentApplication.updateOne(
    { _id: applicationId, organizationId },
    { $set: { "ranking.status": "queued", "ranking.queueJobId": latest._id, "ranking.error": null } }
  );
  return latest;
}

export async function rerankApplication(
  organizationId: Types.ObjectId,
  applicationId: Types.ObjectId,
  requestedByUserId: string
) {
  const application = await RecruitmentApplication.findOne({ _id: applicationId, organizationId }).lean();
  if (!application) throw new RecruitmentRankingServiceError("Application not found", 404);
  const queued = await enqueueApplicationRanking({
    organizationId,
    jobId: application.jobId,
    applicationId,
    inputRevision: application.revision,
    requestedByUserId,
    force: true,
  });
  if (!queued) throw new RecruitmentRankingServiceError("Approve a rubric before ranking", 409);
  return queued;
}

export async function getRankingState(organizationId: Types.ObjectId, applicationId: Types.ObjectId) {
  const application = await RecruitmentApplication.findOne({ _id: applicationId, organizationId })
    .select("ranking revision jobId")
    .lean();
  if (!application) throw new RecruitmentRankingServiceError("Application not found", 404);
  const jobs = await RecruitmentRankingJob.find({ organizationId, applicationId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return { ranking: application.ranking, revision: application.revision, jobs };
}

export async function getRerankBatchProgress(organizationId: Types.ObjectId, batchId: string) {
  const counts = await RecruitmentRankingJob.aggregate<{ _id: string; count: number }>([
    { $match: { organizationId, batchId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(counts.map((item) => [item._id, item.count]));
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  if (!total) throw new RecruitmentRankingServiceError("Rerank batch not found", 404);
  return {
    batchId,
    total,
    byStatus,
    completed:
      (byStatus.succeeded ?? 0) + (byStatus.failed ?? 0) + (byStatus.manual_review ?? 0),
  };
}
