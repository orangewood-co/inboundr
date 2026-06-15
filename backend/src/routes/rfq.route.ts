import { Router } from "express";
import { archiveRFQ, listRFQs, getRFQ, retryRFQ, generateQuote, getQuoteReply, sendQuoteReply, downloadRFQPdf, listDraftRFQs, saveRFQDraft, setRFQQuoteNumber } from "../controllers/rfq.controller";
import { requireAuth, requireEmployeeModule, requireFeature, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("rfq"));
router.use(requireEmployeeModule("rfq"));
router.get("/", listRFQs);
router.get("/drafts", listDraftRFQs);
router.get("/:id/pdf", downloadRFQPdf);
router.get("/:id", getRFQ);
router.post("/:id/retry", requireFeature("rfq"), retryRFQ);
router.post("/:id/save-draft", requireFeature("rfq"), saveRFQDraft);
router.patch("/:id/quote-number", requireFeature("rfq"), setRFQQuoteNumber);
router.post("/:id/generate-quote", requireFeature("rfq"), generateQuote);
router.post("/:id/send-quote", requireFeature("rfq"), sendQuoteReply);
router.get("/:id/reply", getQuoteReply);
router.patch("/:id/archive", requireFeature("rfq"), archiveRFQ);

export default router;
