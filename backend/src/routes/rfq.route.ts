import { Router } from "express";
import { listRFQs, getRFQ, retryRFQ, generateQuote, getQuoteReply } from "../controllers/rfq.controller";

const router = Router();

router.get("/", listRFQs);
router.get("/:id", getRFQ);
router.post("/:id/retry", retryRFQ);
router.post("/:id/generate-quote", generateQuote);
router.get("/:id/reply", getQuoteReply);

export default router;
