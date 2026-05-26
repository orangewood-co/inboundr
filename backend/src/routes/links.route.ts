import { Router } from "express";
import {
  archiveLink,
  createLink,
  getLink,
  listLinkEvents,
  listLinks,
  updateLink,
} from "../controllers/links.controller";
import {
  requireAuth,
  requireFeature,
  requireOrganization,
  requireOrganizationRole,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("links"));

router.get("/", listLinks);
router.post("/", requireOrganizationRole(["owner", "admin"]), createLink);
router.get("/:id", getLink);
router.put("/:id", requireOrganizationRole(["owner", "admin"]), updateLink);
router.delete("/:id", requireOrganizationRole(["owner", "admin"]), archiveLink);
router.get("/:id/events", listLinkEvents);

export default router;
