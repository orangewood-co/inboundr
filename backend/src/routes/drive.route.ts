import { Router } from "express";
import {
  abortDriveUpload,
  completeDriveUpload,
  createDriveExport,
  createDriveFolder,
  createDrivePublicLink,
  getDriveExport,
  getDriveFileUrl,
  getDriveNode,
  getDriveQuota,
  getDriveUploadPartUrl,
  initiateDriveUpload,
  listDriveNodes,
  listDrivePublicLinks,
  listDriveShares,
  moveDriveNode,
  permanentlyDeleteDriveNode,
  restoreDriveNode,
  revokeDrivePublicLink,
  shareDriveNode,
  trashDriveNode,
  unshareDriveNode,
  updateDriveNode,
} from "../controllers/drive.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("drive"));
router.use(requireEmployeeModule("drive"));

router.get("/", listDriveNodes);
router.get("/quota", getDriveQuota);
router.post("/folders", createDriveFolder);
router.post("/uploads/initiate", initiateDriveUpload);
router.post("/uploads/:id/parts", getDriveUploadPartUrl);
router.post("/uploads/:id/complete", completeDriveUpload);
router.post("/uploads/:id/abort", abortDriveUpload);
router.get("/exports/:jobId", getDriveExport);
router.get("/exports/:jobId/download", getDriveExport);
router.get("/:id", getDriveNode);
router.patch("/:id", updateDriveNode);
router.post("/:id/move", moveDriveNode);
router.post("/:id/trash", trashDriveNode);
router.post("/:id/restore", restoreDriveNode);
router.delete("/:id", permanentlyDeleteDriveNode);
router.get("/:id/view-url", getDriveFileUrl);
router.get("/:id/download-url", getDriveFileUrl);
router.get("/:id/shares", listDriveShares);
router.post("/:id/shares", shareDriveNode);
router.delete("/:id/shares/:userId", unshareDriveNode);
router.get("/:id/public-links", listDrivePublicLinks);
router.post("/:id/public-links", createDrivePublicLink);
router.delete("/:id/public-links/:linkId", revokeDrivePublicLink);
router.post("/:id/export", createDriveExport);

export default router;
