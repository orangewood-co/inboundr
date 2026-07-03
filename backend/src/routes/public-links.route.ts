import { Router } from "express";
import {
  checkPublicLink,
  redirectShortLink,
  trackLocationAndRedirect,
  unlockPublicLink,
} from "../controllers/links.controller";
import { linkUnlockLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:code/check", checkPublicLink);
router.post("/:code/unlock", linkUnlockLimiter, unlockPublicLink);
router.post("/:code/track-location", trackLocationAndRedirect);
router.get("/:code", redirectShortLink);

export default router;
