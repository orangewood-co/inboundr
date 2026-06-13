import { Router } from "express";
import {
  createVoiceCall,
  finalizeVoiceCall,
  getVoiceConfigByNumber,
  voiceProductSearch,
} from "../controllers/internal-voice.controller";
import { requireInternalKey } from "../middleware/internal-auth.middleware";

const router = Router();

router.use(requireInternalKey);

router.get("/config", getVoiceConfigByNumber);
router.post("/calls", createVoiceCall);
router.patch("/calls/:id", finalizeVoiceCall);
router.post("/product-search", voiceProductSearch);

export default router;
