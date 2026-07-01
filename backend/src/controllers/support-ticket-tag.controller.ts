import type { Request, Response } from "express";
import mongoose from "mongoose";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  DEFAULT_SUPPORT_TICKET_TAG_COLOR,
  SUPPORT_TICKET_TAG_COLORS,
  SupportTicketTag,
  type ISupportTicketTag,
  type SupportTicketTagColor,
} from "../models/support-ticket-tag.model";
import { Ticket } from "../models/ticket.model";

const TAG_NAME_MAX = 40;

function serializeTag(tag: ISupportTicketTag | any, usageCount = 0) {
  return {
    id: String(tag._id),
    name: tag.name,
    color: tag.color ?? DEFAULT_SUPPORT_TICKET_TAG_COLOR,
    usageCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

function normalizeName(value: unknown): string {
  return String(value ?? "").trim().slice(0, TAG_NAME_MAX);
}

function normalizeColor(value: unknown): SupportTicketTagColor {
  const color = String(value ?? "").trim().toLowerCase();
  return (SUPPORT_TICKET_TAG_COLORS as readonly string[]).includes(color)
    ? (color as SupportTicketTagColor)
    : DEFAULT_SUPPORT_TICKET_TAG_COLOR;
}

async function usageCountsByTag(
  organizationId: mongoose.Types.ObjectId,
  tagIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  if (tagIds.length === 0) return new Map();
  const rows = await Ticket.aggregate([
    { $match: { organizationId, tagIds: { $in: tagIds } } },
    { $unwind: "$tagIds" },
    { $match: { tagIds: { $in: tagIds } } },
    { $group: { _id: "$tagIds", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row: any) => [String(row._id), row.count as number]));
}

export async function listTicketTags(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const tags = await SupportTicketTag.find({ organizationId: orgReq.organization._id })
      .sort({ name: 1 })
      .lean();
    const counts = await usageCountsByTag(
      orgReq.organization._id,
      tags.map((tag) => tag._id as mongoose.Types.ObjectId)
    );
    res.json({
      tags: tags.map((tag) => serializeTag(tag, counts.get(String(tag._id)) ?? 0)),
    });
  } catch (err) {
    console.error("Failed to list support ticket tags:", err);
    res.status(500).json({ error: "Failed to load ticket tags" });
  }
}

export async function createTicketTag(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const name = normalizeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Tag name is required" });
      return;
    }
    const color = normalizeColor(req.body?.color);

    const existing = await SupportTicketTag.findOne({
      organizationId: orgReq.organization._id,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).lean();
    if (existing) {
      res.status(409).json({ error: "A tag with this name already exists" });
      return;
    }

    const tag = await SupportTicketTag.create({
      organizationId: orgReq.organization._id,
      name,
      color,
      createdBy: orgReq.user.id,
      updatedBy: orgReq.user.id,
    });
    res.status(201).json({ tag: serializeTag(tag, 0) });
  } catch (err) {
    console.error("Failed to create support ticket tag:", err);
    res.status(500).json({ error: "Failed to create ticket tag" });
  }
}

export async function updateTicketTag(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Ticket tag not found" });
      return;
    }

    const update: Record<string, unknown> = { updatedBy: orgReq.user.id };
    if (req.body?.name !== undefined) {
      const name = normalizeName(req.body.name);
      if (!name) {
        res.status(400).json({ error: "Tag name is required" });
        return;
      }
      const duplicate = await SupportTicketTag.findOne({
        _id: { $ne: id },
        organizationId: orgReq.organization._id,
        name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      }).lean();
      if (duplicate) {
        res.status(409).json({ error: "A tag with this name already exists" });
        return;
      }
      update.name = name;
    }
    if (req.body?.color !== undefined) update.color = normalizeColor(req.body.color);

    const tag = await SupportTicketTag.findOneAndUpdate(
      { _id: id, organizationId: orgReq.organization._id },
      update,
      { new: true }
    ).lean();
    if (!tag) {
      res.status(404).json({ error: "Ticket tag not found" });
      return;
    }
    const counts = await usageCountsByTag(orgReq.organization._id, [
      tag._id as mongoose.Types.ObjectId,
    ]);
    res.json({ tag: serializeTag(tag, counts.get(String(tag._id)) ?? 0) });
  } catch (err) {
    console.error("Failed to update support ticket tag:", err);
    res.status(500).json({ error: "Failed to update ticket tag" });
  }
}

export async function deleteTicketTag(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Ticket tag not found" });
      return;
    }
    const deleted = await SupportTicketTag.findOneAndDelete({
      _id: id,
      organizationId: orgReq.organization._id,
    });
    if (!deleted) {
      res.status(404).json({ error: "Ticket tag not found" });
      return;
    }
    await Ticket.updateMany(
      { organizationId: orgReq.organization._id, tagIds: deleted._id },
      { $pull: { tagIds: deleted._id } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete support ticket tag:", err);
    res.status(500).json({ error: "Failed to delete ticket tag" });
  }
}
