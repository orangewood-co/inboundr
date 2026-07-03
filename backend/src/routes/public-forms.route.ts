import { Router } from "express";
import { getPublicForm, submitPublicForm } from "../controllers/forms.controller";
import { createPublicFormPresign } from "../controllers/uploads.controller";
import { publicReadLimiter, publicWriteLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:slug", publicReadLimiter, getPublicForm);
router.post("/:slug/uploads/presign", publicWriteLimiter, createPublicFormPresign);
router.post("/:slug/submissions", publicWriteLimiter, submitPublicForm);

export default router;
