import { Router } from "express";
import {
  createPublicDriveExport,
  getPublicDriveExport,
  getPublicDriveFileUrl,
  getPublicDriveLink,
  listPublicDriveChildren,
} from "../controllers/drive.controller";
import { publicReadLimiter, publicWriteLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:token", publicReadLimiter, getPublicDriveLink);
router.get("/:token/children", publicReadLimiter, listPublicDriveChildren);
router.get("/:token/files/:nodeId/view-url", publicReadLimiter, getPublicDriveFileUrl);
router.get("/:token/files/:nodeId/download-url", publicReadLimiter, getPublicDriveFileUrl);
router.post("/:token/export", publicWriteLimiter, createPublicDriveExport);
router.get("/:token/exports/:jobId", publicReadLimiter, getPublicDriveExport);
router.get("/:token/exports/:jobId/download", publicReadLimiter, getPublicDriveExport);

export default router;
