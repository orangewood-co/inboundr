import { Router, raw } from "express";

import { whatsAppWebhook, whatsAppWebhookVerify } from "../controllers/whatsapp.controller";

const router = Router();

// Meta's verification handshake (no body).
router.get("/webhook", whatsAppWebhookVerify);
// Raw body is required so X-Hub-Signature-256 verifies against exact bytes.
router.post("/webhook", raw({ type: "*/*", limit: "2mb" }), whatsAppWebhook);

export default router;
