import { Router, raw } from "express";

import { openaiCallWebhook, vobizCallback } from "../controllers/telephony.controller";

const router = Router();

// Raw body is required so webhook/callback signatures verify against exact bytes.
router.post("/openai/webhook", raw({ type: "*/*", limit: "1mb" }), openaiCallWebhook);
router.post("/vobiz/callback", raw({ type: "*/*", limit: "2mb" }), vobizCallback);

export default router;
