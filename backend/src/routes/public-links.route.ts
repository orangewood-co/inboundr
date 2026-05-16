import { Router } from "express";
import {
  checkPublicLink,
  redirectShortLink,
  trackLocationAndRedirect,
  unlockPublicLink,
} from "../controllers/links.controller";

const router = Router();

router.get("/:code/check", checkPublicLink);
router.post("/:code/unlock", unlockPublicLink);
router.post("/:code/track-location", trackLocationAndRedirect);
router.get("/:code", redirectShortLink);

export default router;
