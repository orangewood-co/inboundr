import { Router } from "express";
import {
  getDigestPreferences,
  updateDigestPreferences,
  sendTestDigest,
} from "../controllers/digest.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/preferences", getDigestPreferences);
router.put("/preferences", updateDigestPreferences);
router.post("/test", sendTestDigest);

export default router;
