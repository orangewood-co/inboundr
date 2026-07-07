import { Router } from "express";
import {
  activateAssetHandler,
  addAttachment,
  addImages,
  addRepairHandler,
  adjustValueHandler,
  archiveCategory,
  archiveLocation,
  assignAssetHandler,
  createAsset,
  createCategory,
  createLocation,
  deleteAsset,
  depreciationRegister,
  disposeAssetHandler,
  getAsset,
  getCategoryDefaults,
  getSettings,
  getStats,
  importAssets,
  listAssets,
  listCategories,
  listLocations,
  moveAssetHandler,
  removeAttachment,
  removeImage,
  setConditionHandler,
  setCoverImage,
  updateAsset,
  updateCategory,
  updateLocation,
  updateSettings,
} from "../controllers/assets.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("assets"));
router.use(requireEmployeeModule("assets"));

router.get("/settings", getSettings);
router.put("/settings", requireOrganizationAdmin(), updateSettings);

router.get("/categories", listCategories);
router.post("/categories", requireOrganizationAdmin(), createCategory);
router.get("/categories/:id/defaults", getCategoryDefaults);
router.put("/categories/:id", requireOrganizationAdmin(), updateCategory);
router.patch("/categories/:id/archive", requireOrganizationAdmin(), archiveCategory);

router.get("/locations", listLocations);
router.post("/locations", requireOrganizationAdmin(), createLocation);
router.put("/locations/:id", requireOrganizationAdmin(), updateLocation);
router.patch("/locations/:id/archive", requireOrganizationAdmin(), archiveLocation);

router.get("/stats", getStats);
router.get("/report/depreciation-register", depreciationRegister);
router.post("/import", requireOrganizationAdmin(), importAssets);

router.get("/", listAssets);
router.post("/", requireOrganizationAdmin(), createAsset);
router.get("/:id", getAsset);
router.put("/:id", requireOrganizationAdmin(), updateAsset);
router.delete("/:id", requireOrganizationAdmin(), deleteAsset);

router.post("/:id/activate", requireOrganizationAdmin(), activateAssetHandler);
router.post("/:id/assign", requireOrganizationAdmin(), assignAssetHandler);
router.post("/:id/move", requireOrganizationAdmin(), moveAssetHandler);
router.post("/:id/condition", requireOrganizationAdmin(), setConditionHandler);
router.post("/:id/adjust-value", requireOrganizationAdmin(), adjustValueHandler);
router.post("/:id/dispose", requireOrganizationAdmin(), disposeAssetHandler);
router.post("/:id/repairs", addRepairHandler);
router.post("/:id/attachments", requireOrganizationAdmin(), addAttachment);
router.delete("/:id/attachments/:attachmentId", requireOrganizationAdmin(), removeAttachment);
router.post("/:id/images", requireOrganizationAdmin(), addImages);
router.delete("/:id/images/:imageId", requireOrganizationAdmin(), removeImage);
router.post("/:id/images/:imageId/cover", requireOrganizationAdmin(), setCoverImage);

export default router;
