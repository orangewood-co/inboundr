import { Router } from "express";
import { createAuthenticatedPresign, createAuthenticatedViewUrl } from "../controllers/uploads.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get("/view", createAuthenticatedViewUrl);
router.post("/presign", createAuthenticatedPresign);

export default router;
