import { Router } from "express";
import {
  getMyFeedback,
  listMyFeedback,
  replyToMyFeedback,
  submitFeedback,
} from "../controllers/feedback.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.post("/", submitFeedback);
router.get("/", listMyFeedback);
router.get("/:id", getMyFeedback);
router.post("/:id/messages", replyToMyFeedback);

export default router;
