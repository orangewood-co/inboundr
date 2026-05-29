import { Router } from "express";
import { archiveRFQ, listRFQs, getRFQ, retryRFQ, generateQuote, getQuoteReply, sendQuoteReply, downloadRFQPdf, listDraftRFQs, saveRFQDraft, setRFQQuoteNumber } from "../controllers/rfq.controller";
import { requireAuth, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("rfq"));
router.get("/", listRFQs);
router.get("/drafts", listDraftRFQs);
router.get("/:id/pdf", downloadRFQPdf);
router.get("/:id", getRFQ);
router.post("/:id/retry", retryRFQ);
router.post("/:id/save-draft", saveRFQDraft);
router.patch("/:id/quote-number", setRFQQuoteNumber);
router.post("/:id/generate-quote", generateQuote);
router.post("/:id/send-quote", sendQuoteReply);
router.get("/:id/reply", getQuoteReply);
router.patch("/:id/archive", archiveRFQ);

export default router;
