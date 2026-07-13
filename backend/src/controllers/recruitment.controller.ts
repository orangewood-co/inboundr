import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { RecruitmentJob, RECRUITMENT_JOB_STATUSES } from "../models/recruitment-job.model";
import { RecruitmentCandidate } from "../models/recruitment-candidate.model";
import { RecruitmentApplication, RECRUITMENT_APPLICATION_STATUSES } from "../models/recruitment-application.model";
import { RecruitmentApplicationRevision } from "../models/recruitment-application-revision.model";
import { RecruitmentActivity } from "../models/recruitment-activity.model";
import { RecruitmentNote } from "../models/recruitment-note.model";
import { RecruitmentAttachment } from "../models/recruitment-attachment.model";
import { RecruitmentAcknowledgementDelivery } from "../models/recruitment-acknowledgement-delivery.model";
import {
  RecruitmentServiceError,
  addApplicationNote,
  changeRecruitmentJobStatus,
  createApplication,
  createCandidate,
  createRecruitmentJob,
  deleteRecruitmentJob,
  getEmployeeHandoff,
  getRecruitmentDashboard,
  getRecruitmentSettings,
  listRecruitmentActivity,
  moveApplicationStage,
  presignRecruitmentAttachment,
  presignRecruitmentBanner,
  saveRecruitmentAttachment,
  saveRecruitmentBanner,
  hardDeleteRecruitmentApplication,
  hardDeleteRecruitmentCandidate,
  updateRecruitmentJob,
  updateRecruitmentSettings,
  viewRecruitmentAttachment,
  type RecruitmentActor,
} from "../services/recruitment.service";
import {
  approveRubric,
  enqueueActiveApplications,
  generateRubricDraft,
  getJobRubrics,
  getRankingState,
  getRerankBatchProgress,
  regenerateRubric,
  rerankApplication,
  retryApplicationRanking,
  updateRubricDraft,
} from "../services/recruitment-ranking.service";

function ctx(req: Request) {
  const value = req as OrganizationRequest;
  return {
    organizationId: value.organization._id,
    actor: { userId: value.user.id, name: value.user.name ?? value.user.email ?? "" } satisfies RecruitmentActor,
  };
}
const text = (value: unknown) => String(value ?? "").trim();
const validId = (value: unknown): value is string => typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
const searchRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
function page(req: Request) {
  const number = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  return { number, limit, skip: (number - 1) * limit };
}
function handle(res: Response, error: unknown, fallback: string) {
  if (
    error instanceof RecruitmentServiceError ||
    (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number")
  ) {
    const statusCode = Number(error.statusCode);
    res.status(statusCode).json({ error: error.message });
  } else {
    console.error(fallback, error);
    res.status(500).json({ error: fallback });
  }
}

export async function getSettings(req: Request, res: Response) {
  try { res.json({ settings: await getRecruitmentSettings(ctx(req).organizationId) }); }
  catch (error) { handle(res, error, "Failed to get recruitment settings"); }
}
export async function updateSettings(req: Request, res: Response) {
  try { res.json({ settings: await updateRecruitmentSettings(ctx(req).organizationId, req.body ?? {}) }); }
  catch (error) { handle(res, error, "Failed to update recruitment settings"); }
}
export async function presignBanner(req: Request, res: Response) {
  try {
    res.json(await presignRecruitmentBanner(ctx(req).organizationId, req.body ?? {}));
  } catch (error) {
    handle(res, error, "Failed to prepare careers banner upload");
  }
}
export async function saveBanner(req: Request, res: Response) {
  try {
    res.json({ settings: await saveRecruitmentBanner(ctx(req).organizationId, req.body ?? {}) });
  } catch (error) {
    handle(res, error, "Failed to save careers banner");
  }
}

export async function listJobs(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const paging = page(req);
    const filter: Record<string, unknown> = { organizationId };
    const statuses = text(req.query.status).split(",").filter((item) => RECRUITMENT_JOB_STATUSES.includes(item as any));
    if (statuses.length) filter.status = { $in: statuses };
    if (text(req.query.search)) {
      const match = searchRegex(text(req.query.search));
      filter.$or = [{ title: match }, { department: match }, { location: match }];
    }
    const [items, total] = await Promise.all([
      RecruitmentJob.find(filter).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
      RecruitmentJob.countDocuments(filter),
    ]);
    res.json({ items, page: paging.number, limit: paging.limit, total, totalPages: Math.ceil(total / paging.limit) });
  } catch (error) { handle(res, error, "Failed to list recruitment jobs"); }
}
export async function createJob(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.status(201).json({ job: await createRecruitmentJob(organizationId, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to create recruitment job"); }
}
export async function getJob(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const job = validId(req.params.id) ? await RecruitmentJob.findOne({ _id: req.params.id, organizationId }).lean() : null;
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const [stageCounts, recentActivity] = await Promise.all([
      RecruitmentApplication.aggregate([{ $match: { organizationId, jobId: job._id } }, { $group: { _id: "$stageId", count: { $sum: 1 } } }]),
      RecruitmentActivity.find({ organizationId, jobId: job._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.json({ job, stageCounts, recentActivity });
  } catch (error) { handle(res, error, "Failed to get recruitment job"); }
}
export async function updateJob(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.json({ job: await updateRecruitmentJob(organizationId, req.params.id, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to update recruitment job"); }
}
export async function changeJobStatus(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.json({ job: await changeRecruitmentJobStatus(organizationId, req.params.id, req.body?.status, actor) });
  } catch (error) { handle(res, error, "Failed to change recruitment job status"); }
}
export async function deleteJob(req: Request, res: Response) {
  try { await deleteRecruitmentJob(ctx(req).organizationId, req.params.id); res.status(204).end(); }
  catch (error) { handle(res, error, "Failed to delete recruitment job"); }
}
export async function getJobPipeline(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const job = validId(req.params.id) ? await RecruitmentJob.findOne({ _id: req.params.id, organizationId }).lean() : null;
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const applications = await RecruitmentApplication.find({ organizationId, jobId: job._id, status: { $ne: "archived" } })
      .populate("candidateId").sort({ stageId: 1, pipelineOrder: 1 }).lean();
    res.json({
      job,
      applications,
      byStage: Object.fromEntries(job.stages.map((stage) => [stage.id, applications.filter((item) => item.stageId === stage.id)])),
    });
  } catch (error) { handle(res, error, "Failed to get recruitment pipeline"); }
}

export async function listCandidates(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const paging = page(req);
    const filter: Record<string, unknown> = { organizationId };
    if (text(req.query.search)) {
      const match = searchRegex(text(req.query.search));
      filter.$or = [{ fullName: match }, { email: match }, { headline: match }, { skills: match }, { tags: match }];
    }
    const [items, total] = await Promise.all([
      RecruitmentCandidate.find(filter).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
      RecruitmentCandidate.countDocuments(filter),
    ]);
    res.json({ items, page: paging.number, limit: paging.limit, total, totalPages: Math.ceil(total / paging.limit) });
  } catch (error) { handle(res, error, "Failed to list recruitment candidates"); }
}
export async function createCandidateHandler(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.status(201).json({ candidate: await createCandidate(organizationId, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to create recruitment candidate"); }
}
export async function getCandidate(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const candidate = validId(req.params.id) ? await RecruitmentCandidate.findOne({ _id: req.params.id, organizationId }).lean() : null;
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    const [applications, attachments] = await Promise.all([
      RecruitmentApplication.find({ organizationId, candidateId: candidate._id }).populate("jobId", "title department status stages").sort({ updatedAt: -1 }).lean(),
      RecruitmentAttachment.find({ organizationId, candidateId: candidate._id }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ candidate, applications, attachments });
  } catch (error) { handle(res, error, "Failed to get recruitment candidate"); }
}
export async function deleteCandidate(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    res.json(await hardDeleteRecruitmentCandidate(
      organizationId,
      req.params.id,
      req.body?.confirmation
    ));
  } catch (error) { handle(res, error, "Failed to hard delete recruitment candidate"); }
}

export async function listApplications(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const paging = page(req);
    const filter: Record<string, unknown> = { organizationId };
    if (validId(req.query.jobId)) filter.jobId = req.query.jobId;
    if (validId(req.query.candidateId)) filter.candidateId = req.query.candidateId;
    if (text(req.query.stageId)) filter.stageId = text(req.query.stageId);
    const statuses = text(req.query.status).split(",").filter((item) => RECRUITMENT_APPLICATION_STATUSES.includes(item as any));
    if (statuses.length) filter.status = { $in: statuses };
    const [items, total] = await Promise.all([
      RecruitmentApplication.find(filter).populate("jobId", "title department status stages")
        .populate("candidateId", "fullName email phone headline tags").sort({ updatedAt: -1 })
        .skip(paging.skip).limit(paging.limit).lean(),
      RecruitmentApplication.countDocuments(filter),
    ]);
    res.json({ items, page: paging.number, limit: paging.limit, total, totalPages: Math.ceil(total / paging.limit) });
  } catch (error) { handle(res, error, "Failed to list recruitment applications"); }
}
export async function createApplicationHandler(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.status(201).json({ application: await createApplication(organizationId, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to create recruitment application"); }
}
export async function getApplication(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    const application = validId(req.params.id)
      ? await RecruitmentApplication.findOne({ _id: req.params.id, organizationId }).populate("jobId").populate("candidateId").lean()
      : null;
    if (!application) { res.status(404).json({ error: "Application not found" }); return; }
    const [revisions, activity, notes, attachments, acknowledgements] = await Promise.all([
      RecruitmentApplicationRevision.find({ organizationId, applicationId: application._id }).sort({ revision: -1 }).lean(),
      RecruitmentActivity.find({ organizationId, applicationId: application._id }).sort({ createdAt: -1 }).lean(),
      RecruitmentNote.find({ organizationId, applicationId: application._id }).sort({ createdAt: -1 }).lean(),
      RecruitmentAttachment.find({ organizationId, applicationId: application._id }).sort({ createdAt: -1 }).lean(),
      RecruitmentAcknowledgementDelivery.find({ organizationId, applicationId: application._id })
        .sort({ applicationRevision: -1 })
        .lean(),
    ]);
    res.json({ application, revisions, activity, notes, attachments, acknowledgements });
  } catch (error) { handle(res, error, "Failed to get recruitment application"); }
}
export async function applicationEmployeeHandoff(req: Request, res: Response) {
  try {
    res.json(await getEmployeeHandoff(ctx(req).organizationId, req.params.id));
  } catch (error) { handle(res, error, "Failed to prepare employee handoff"); }
}
export async function deleteApplication(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    res.json(await hardDeleteRecruitmentApplication(
      organizationId,
      req.params.id,
      req.body?.confirmation
    ));
  } catch (error) { handle(res, error, "Failed to hard delete recruitment application"); }
}
export async function moveApplication(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.json({ application: await moveApplicationStage(organizationId, req.params.id, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to move recruitment application"); }
}
export async function listNotes(req: Request, res: Response) {
  try {
    const { organizationId } = ctx(req);
    if (!validId(req.params.id) || !(await RecruitmentApplication.exists({ _id: req.params.id, organizationId }))) {
      res.status(404).json({ error: "Application not found" }); return;
    }
    res.json({ items: await RecruitmentNote.find({ organizationId, applicationId: req.params.id }).sort({ createdAt: -1 }).lean() });
  } catch (error) { handle(res, error, "Failed to list recruitment notes"); }
}
export async function addNote(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.status(201).json({ note: await addApplicationNote(organizationId, req.params.id, req.body?.body, actor) });
  } catch (error) { handle(res, error, "Failed to add recruitment note"); }
}
export async function presignAttachment(req: Request, res: Response) {
  try { res.json(await presignRecruitmentAttachment(ctx(req).organizationId, req.params.id, req.body ?? {})); }
  catch (error) { handle(res, error, "Failed to presign recruitment attachment"); }
}
export async function saveAttachment(req: Request, res: Response) {
  try {
    const { organizationId, actor } = ctx(req);
    res.status(201).json({ attachment: await saveRecruitmentAttachment(organizationId, req.params.id, req.body ?? {}, actor) });
  } catch (error) { handle(res, error, "Failed to save recruitment attachment"); }
}
export async function viewAttachment(req: Request, res: Response) {
  try {
    res.json(await viewRecruitmentAttachment(ctx(req).organizationId, req.params.id, req.params.attachmentId, req.query.download === "true" || req.query.download === "1"));
  } catch (error) { handle(res, error, "Failed to view recruitment attachment"); }
}
export async function listActivity(req: Request, res: Response) {
  try {
    res.json(await listRecruitmentActivity(
      ctx(req).organizationId,
      req.query as Record<string, unknown>
    ));
  } catch (error) { handle(res, error, "Failed to list recruitment activity"); }
}
export async function dashboard(req: Request, res: Response) {
  try {
    res.json(await getRecruitmentDashboard(ctx(req).organizationId));
  } catch (error) { handle(res, error, "Failed to get recruitment dashboard"); }
}

export async function listJobRubrics(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Job not found" }); return; }
    res.json(await getJobRubrics(ctx(req).organizationId, new mongoose.Types.ObjectId(req.params.id)));
  } catch (error) { handle(res, error, "Failed to get job rubrics"); }
}

export async function generateJobRubric(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Job not found" }); return; }
    const { organizationId, actor } = ctx(req);
    const rubric = await generateRubricDraft(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      actor
    );
    res.status(201).json({ rubric });
  } catch (error) { handle(res, error, "Failed to generate job rubric"); }
}

export async function editJobRubric(req: Request, res: Response) {
  try {
    if (!validId(req.params.id) || !validId(req.params.rubricId)) {
      res.status(404).json({ error: "Rubric not found" }); return;
    }
    const { organizationId, actor } = ctx(req);
    const rubric = await updateRubricDraft(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      new mongoose.Types.ObjectId(req.params.rubricId),
      req.body ?? {},
      actor
    );
    res.json({ rubric });
  } catch (error) { handle(res, error, "Failed to update job rubric"); }
}

export async function approveJobRubric(req: Request, res: Response) {
  try {
    if (!validId(req.params.id) || !validId(req.params.rubricId)) {
      res.status(404).json({ error: "Rubric not found" }); return;
    }
    const { organizationId, actor } = ctx(req);
    res.json(await approveRubric(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      new mongoose.Types.ObjectId(req.params.rubricId),
      actor,
      req.body?.enqueueActiveApplications === true
    ));
  } catch (error) { handle(res, error, "Failed to approve job rubric"); }
}

export async function regenerateJobRubric(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Job not found" }); return; }
    const { organizationId, actor } = ctx(req);
    res.status(201).json(await regenerateRubric(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      actor,
      req.body?.approveAndEnqueueActiveApplications === true
    ));
  } catch (error) { handle(res, error, "Failed to regenerate job rubric"); }
}

export async function applicationRanking(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Application not found" }); return; }
    res.json(await getRankingState(
      ctx(req).organizationId,
      new mongoose.Types.ObjectId(req.params.id)
    ));
  } catch (error) { handle(res, error, "Failed to get application ranking"); }
}

export async function retryApplicationRankingHandler(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Application not found" }); return; }
    const { organizationId, actor } = ctx(req);
    res.status(202).json({ job: await retryApplicationRanking(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      actor.userId
    ) });
  } catch (error) { handle(res, error, "Failed to retry application ranking"); }
}

export async function rerankApplicationHandler(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Application not found" }); return; }
    const { organizationId, actor } = ctx(req);
    res.status(202).json({ job: await rerankApplication(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      actor.userId
    ) });
  } catch (error) { handle(res, error, "Failed to queue application rerank"); }
}

export async function rerankAllJobApplications(req: Request, res: Response) {
  try {
    if (!validId(req.params.id)) { res.status(404).json({ error: "Job not found" }); return; }
    const { organizationId, actor } = ctx(req);
    res.status(202).json(await enqueueActiveApplications(
      organizationId,
      new mongoose.Types.ObjectId(req.params.id),
      actor.userId,
      true
    ));
  } catch (error) { handle(res, error, "Failed to queue job rerank"); }
}

export async function rerankBatchProgress(req: Request, res: Response) {
  try {
    res.json(await getRerankBatchProgress(ctx(req).organizationId, text(req.params.batchId)));
  } catch (error) { handle(res, error, "Failed to get rerank progress"); }
}

