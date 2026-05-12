import { Router } from "express";
import { getPublicForm, submitPublicForm } from "../controllers/forms.controller";

const router = Router();

router.get("/:slug", getPublicForm);
router.post("/:slug/submissions", submitPublicForm);

export default router;
