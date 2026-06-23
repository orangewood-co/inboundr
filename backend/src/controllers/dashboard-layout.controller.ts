import type { Request, Response } from "express";

import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import {
  DashboardLayout,
  type IDashboardLayoutItem,
} from "../models/dashboard-layout.model";

const MAX_ITEMS = 50;
const MAX_ID_LENGTH = 64;

function sanitizeItems(raw: unknown): IDashboardLayoutItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: IDashboardLayoutItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const id = String((entry as { id?: unknown }).id ?? "").trim();
    if (!id || id.length > MAX_ID_LENGTH || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, hidden: Boolean((entry as { hidden?: unknown }).hidden) });
    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}

export async function getMyDashboardLayout(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;

    const layout = await DashboardLayout.findOne({
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();

    res.json({ items: layout?.items ?? [] });
  } catch (err) {
    console.error("Error fetching dashboard layout:", err);
    res.status(500).json({ error: "Failed to fetch dashboard layout" });
  }
}

export async function putMyDashboardLayout(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const items = sanitizeItems((req.body ?? {}).items);

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: authReq.user.id, organizationId: organization._id },
      { items },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ items: layout?.items ?? [] });
  } catch (err) {
    console.error("Error saving dashboard layout:", err);
    res.status(500).json({ error: "Failed to save dashboard layout" });
  }
}
