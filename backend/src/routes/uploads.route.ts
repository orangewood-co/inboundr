import { Router } from "express";
import { createAuthenticatedPresign, createAuthenticatedViewUrl } from "../controllers/uploads.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/view", createAuthenticatedViewUrl);
router.post("/presign", createAuthenticatedPresign);

export default router;
