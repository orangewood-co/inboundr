import { Router } from "express";
import { getPublicForm, submitPublicForm } from "../controllers/forms.controller";
import { createPublicFormPresign } from "../controllers/uploads.controller";

const router = Router();

router.get("/:slug", getPublicForm);
router.post("/:slug/uploads/presign", createPublicFormPresign);
router.post("/:slug/submissions", submitPublicForm);

export default router;
