import type { Request, Response } from "express";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";

function parseLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "20"), 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, parsed));
}

export async function listMyNotifications(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const result = await listNotifications({
      organizationId: organization._id,
      userId: authReq.user.id,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : null,
      limit: parseLimit(req.query.limit),
    });

    res.json(result);
  } catch (err) {
    console.error("Error listing notifications:", err);
    res.status(500).json({ error: "Failed to list notifications" });
  }
}

export async function getMyUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const unreadCount = await getUnreadNotificationCount(organization._id, authReq.user.id);
    res.json({ unreadCount });
  } catch (err) {
    console.error("Error fetching unread notification count:", err);
    res.status(500).json({ error: "Failed to fetch unread notification count" });
  }
}

export async function updateNotificationReadState(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const read = req.body?.read !== false;
    const notification = await markNotificationRead({
      organizationId: organization._id,
      userId: authReq.user.id,
      notificationId: String(req.params.id ?? ""),
      read,
    });

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    const unreadCount = await getUnreadNotificationCount(organization._id, authReq.user.id);
    res.json({ notification, unreadCount });
  } catch (err) {
    console.error("Error updating notification read state:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

export async function markMyNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const result = await markAllNotificationsRead({
      organizationId: organization._id,
      userId: authReq.user.id,
    });

    res.json({ ...result, unreadCount: 0 });
  } catch (err) {
    console.error("Error marking notifications read:", err);
    res.status(500).json({ error: "Failed to mark notifications read" });
  }
}
