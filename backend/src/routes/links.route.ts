import { Router } from "express";
import {
  archiveLink,
  createLink,
  getLink,
  listLinkEvents,
  listLinks,
  sendLinkEmail,
  updateLink,
} from "../controllers/links.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("links"));
router.use(requireEmployeeModule("links"));

router.get("/", listLinks);
router.post("/", requireOrganizationAdmin(), createLink);
router.get("/:id", getLink);
router.post("/:id/send", requireOrganizationAdmin(), sendLinkEmail);
router.put("/:id", requireOrganizationAdmin(), updateLink);
router.delete("/:id", requireOrganizationAdmin(), archiveLink);
router.get("/:id/events", listLinkEvents);

export default router;
