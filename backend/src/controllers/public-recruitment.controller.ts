import type { Request, Response } from "express";
import {
  getPublicCareersSite,
  getPublicRecruitmentJob,
  listPublicRecruitmentJobs,
  presignPublicResume,
  submitPublicApplication,
} from "../services/public-recruitment.service";

function handle(res: Response, error: unknown, fallback: string) {
  if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export async function publicCareersSite(req: Request, res: Response) {
  try {
    res.json({ careers: await getPublicCareersSite(req.params.organizationPath) });
  } catch (error) {
    handle(res, error, "Failed to load careers site");
  }
}

export async function publicJobs(req: Request, res: Response) {
  try {
    res.json(
      await listPublicRecruitmentJobs(
        req.params.organizationPath,
        req.query as Record<string, unknown>
      )
    );
  } catch (error) {
    handle(res, error, "Failed to load careers jobs");
  }
}

export async function publicJob(req: Request, res: Response) {
  try {
    res.json({
      job: await getPublicRecruitmentJob(
        req.params.organizationPath,
        req.params.jobSlug
      ),
    });
  } catch (error) {
    handle(res, error, "Failed to load careers job");
  }
}

export async function publicResumePresign(req: Request, res: Response) {
  try {
    res.json(
      await presignPublicResume(
        req.params.organizationPath,
        req.params.jobSlug,
        req.body ?? {},
        { ip: req.ip ?? "" }
      )
    );
  } catch (error) {
    handle(res, error, "Failed to prepare resume upload");
  }
}

export async function publicApplicationSubmit(req: Request, res: Response) {
  try {
    await submitPublicApplication(
      req.params.organizationPath,
      req.params.jobSlug,
      req.body ?? {},
      {
        ip: req.ip ?? "",
        userAgent: req.get("user-agent") ?? "",
        referrer: req.get("referer") ?? "",
      }
    );
    res.status(202).json({
      accepted: true,
      message: "If the application is eligible, it has been received.",
    });
  } catch (error) {
    handle(res, error, "Application could not be submitted");
  }
}
