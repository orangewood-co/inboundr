import type { Request, Response } from "express";
import mongoose from "mongoose";

import { Form } from "../models/form.model";
import { FormFolder } from "../models/form-folder.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { normalizeBranding } from "../services/form-input.service";

function folderName(value: unknown): string {
  return String(value ?? "").trim().slice(0, 80);
}

export async function listFolders(req: Request, res: Response): Promise<void> {
  try {
    const { organization } = req as OrganizationRequest;
    const [folders, counts] = await Promise.all([
      FormFolder.find({ organizationId: organization._id }).sort({ name: 1 }).lean(),
      Form.aggregate([
        {
          $match: {
            organizationId: organization._id,
            status: { $ne: "archived" },
            folderId: { $ne: null },
          },
        },
        { $group: { _id: "$folderId", formCount: { $sum: 1 } } },
      ]),
    ]);

    const countByFolder = new Map(counts.map((entry) => [String(entry._id), entry.formCount]));
    res.json({
      folders: folders.map((folder) => ({
        ...folder,
        formCount: countByFolder.get(String(folder._id)) ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error listing form folders:", err);
    res.status(500).json({ error: "Failed to fetch folders" });
  }
}

export async function createFolder(req: Request, res: Response): Promise<void> {
  try {
    const { organization } = req as OrganizationRequest;
    const name = folderName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    const folder = await FormFolder.create({
      organizationId: organization._id,
      name,
      branding: normalizeBranding(req.body?.branding),
    });
    res.status(201).json({ ...folder.toObject(), formCount: 0 });
  } catch (err) {
    console.error("Error creating form folder:", err);
    res.status(500).json({ error: "Failed to create folder" });
  }
}

export async function updateFolder(req: Request, res: Response): Promise<void> {
  try {
    const folderId = String(req.params.folderId ?? "");
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      res.status(400).json({ error: "Invalid folder id" });
      return;
    }
    const { organization } = req as OrganizationRequest;

    const patch: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const name = folderName(req.body.name);
      if (!name) {
        res.status(400).json({ error: "Folder name is required" });
        return;
      }
      patch.name = name;
    }
    if (req.body?.branding !== undefined) {
      patch.branding = normalizeBranding(req.body.branding);
    }

    const folder = await FormFolder.findOneAndUpdate(
      { _id: folderId, organizationId: organization._id },
      patch,
      { new: true, runValidators: true }
    ).lean();
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const formCount = await Form.countDocuments({
      organizationId: organization._id,
      folderId: folder._id,
      status: { $ne: "archived" },
    });
    res.json({ ...folder, formCount });
  } catch (err) {
    console.error("Error updating form folder:", err);
    res.status(500).json({ error: "Failed to update folder" });
  }
}

export async function deleteFolder(req: Request, res: Response): Promise<void> {
  try {
    const folderId = String(req.params.folderId ?? "");
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      res.status(400).json({ error: "Invalid folder id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const folder = await FormFolder.findOneAndDelete({
      _id: folderId,
      organizationId: organization._id,
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    // Forms are kept; they fall back to their own design.
    await Form.updateMany(
      { organizationId: organization._id, folderId: folder._id },
      { folderId: null, useFolderDesign: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting form folder:", err);
    res.status(500).json({ error: "Failed to delete folder" });
  }
}
