import { Router, raw } from "express";

import { openaiCallWebhook } from "../controllers/telephony.controller";

const router = Router();

// Raw body is required so the webhook signature verifies against exact bytes.
router.post("/openai/webhook", raw({ type: "*/*", limit: "1mb" }), openaiCallWebhook);

export default router;
