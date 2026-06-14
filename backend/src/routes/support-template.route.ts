import { Router } from "express";

import {
  createSupportTemplate,
  deleteSupportTemplate,
  listSupportTemplates,
  updateSupportTemplate,
} from "../controllers/support-template.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get("/", listSupportTemplates);
router.post("/", createSupportTemplate);
router.patch("/:id", updateSupportTemplate);
router.delete("/:id", deleteSupportTemplate);

export default router;
