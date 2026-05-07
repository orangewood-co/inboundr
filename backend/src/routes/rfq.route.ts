import { Router } from "express";
import { listRFQs, getRFQ, retryRFQ, generateQuote, getQuoteReply, sendQuoteReply } from "../controllers/rfq.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", listRFQs);
router.get("/:id", getRFQ);
router.post("/:id/retry", retryRFQ);
router.post("/:id/generate-quote", generateQuote);
router.post("/:id/send-quote", sendQuoteReply);
router.get("/:id/reply", getQuoteReply);

export default router;
