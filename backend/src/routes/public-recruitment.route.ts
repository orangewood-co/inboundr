import cors from "cors";
import { Router } from "express";
import {
  publicApplicationSubmit,
  publicCareersSite,
  publicJob,
  publicJobs,
  publicResumePresign,
} from "../controllers/public-recruitment.controller";
import {
  recruitmentApplicationSubmitLimiter,
  recruitmentPublicReadLimiter,
  recruitmentResumeUploadLimiter,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);
router.options("*splat", (_req, res) => res.sendStatus(204));

router.get("/:organizationPath", recruitmentPublicReadLimiter, publicCareersSite);
router.get("/:organizationPath/jobs", recruitmentPublicReadLimiter, publicJobs);
router.get("/:organizationPath/jobs/:jobSlug", recruitmentPublicReadLimiter, publicJob);
router.post(
  "/:organizationPath/jobs/:jobSlug/resume/presign",
  recruitmentResumeUploadLimiter,
  publicResumePresign
);
router.post(
  "/:organizationPath/jobs/:jobSlug/applications",
  recruitmentApplicationSubmitLimiter,
  publicApplicationSubmit
);

export default router;
