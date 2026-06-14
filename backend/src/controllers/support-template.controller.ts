import type { Request, Response } from "express";
import mongoose from "mongoose";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import { SupportTemplate, type ISupportTemplate } from "../models/support-template.model";

const TITLE_MAX = 120;
const BODY_MAX = 4000;
const SHORTCUT_MAX = 40;

function serializeTemplate(template: ISupportTemplate | any) {
  return {
    id: String(template._id),
    title: template.title,
    body: template.body,
    shortcut: template.shortcut ?? "",
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export async function listSupportTemplates(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const templates = await SupportTemplate.find({ organizationId: orgReq.organization._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ templates: templates.map(serializeTemplate) });
  } catch (err) {
    console.error("Failed to list support templates:", err);
    res.status(500).json({ error: "Failed to list reply templates" });
  }
}

export async function createSupportTemplate(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const shortcut = String(req.body?.shortcut ?? "").trim();

    if (!title) {
      res.status(400).json({ error: "A template title is required" });
      return;
    }
    if (!body) {
      res.status(400).json({ error: "Template text cannot be empty" });
      return;
    }

    const template = await SupportTemplate.create({
      organizationId: orgReq.organization._id,
      title: title.slice(0, TITLE_MAX),
      body: body.slice(0, BODY_MAX),
      shortcut: shortcut.slice(0, SHORTCUT_MAX),
      createdBy: orgReq.user.id,
    });

    res.status(201).json({ template: serializeTemplate(template) });
  } catch (err) {
    console.error("Failed to create support template:", err);
    res.status(500).json({ error: "Failed to create reply template" });
  }
}

export async function updateSupportTemplate(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        res.status(400).json({ error: "A template title is required" });
        return;
      }
      update.title = title.slice(0, TITLE_MAX);
    }
    if (req.body?.body !== undefined) {
      const body = String(req.body.body).trim();
      if (!body) {
        res.status(400).json({ error: "Template text cannot be empty" });
        return;
      }
      update.body = body.slice(0, BODY_MAX);
    }
    if (req.body?.shortcut !== undefined) {
      update.shortcut = String(req.body.shortcut).trim().slice(0, SHORTCUT_MAX);
    }

    const template = await SupportTemplate.findOneAndUpdate(
      { _id: id, organizationId: orgReq.organization._id },
      update,
      { new: true }
    ).lean();

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json({ template: serializeTemplate(template) });
  } catch (err) {
    console.error("Failed to update support template:", err);
    res.status(500).json({ error: "Failed to update reply template" });
  }
}

export async function deleteSupportTemplate(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const result = await SupportTemplate.findOneAndDelete({
      _id: id,
      organizationId: orgReq.organization._id,
    });

    if (!result) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete support template:", err);
    res.status(500).json({ error: "Failed to delete reply template" });
  }
}
