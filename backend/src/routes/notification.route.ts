import { Router } from "express";
import {
  getMyUnreadNotificationCount,
  listMyNotifications,
  markMyNotificationsRead,
  updateNotificationReadState,
} from "../controllers/notification.controller";
import { requireAuth, requireOrganization } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.get("/", listMyNotifications);
router.get("/unread-count", getMyUnreadNotificationCount);
router.patch("/:id/read", updateNotificationReadState);
router.post("/read-all", markMyNotificationsRead);

export default router;
