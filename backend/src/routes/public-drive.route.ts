import { Router } from "express";
import {
  createPublicDriveExport,
  getPublicDriveExport,
  getPublicDriveFileUrl,
  getPublicDriveLink,
  listPublicDriveChildren,
} from "../controllers/drive.controller";

const router = Router();

router.get("/:token", getPublicDriveLink);
router.get("/:token/children", listPublicDriveChildren);
router.get("/:token/files/:nodeId/view-url", getPublicDriveFileUrl);
router.get("/:token/files/:nodeId/download-url", getPublicDriveFileUrl);
router.post("/:token/export", createPublicDriveExport);
router.get("/:token/exports/:jobId", getPublicDriveExport);
router.get("/:token/exports/:jobId/download", getPublicDriveExport);

export default router;
