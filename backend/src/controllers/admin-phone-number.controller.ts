import type { Request, Response } from "express";
import mongoose from "mongoose";

import { Organization } from "../models/organization.model";
import { OrgPhoneNumber, type IOrgPhoneNumber } from "../models/org-phone-number.model";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";

function normalizePhoneNumber(value: unknown): string {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

function serialize(mapping: IOrgPhoneNumber | any, orgName?: string) {
  return {
    id: String(mapping._id),
    organizationId: String(mapping.organizationId),
    organizationName: orgName ?? null,
    phoneNumber: mapping.phoneNumber,
    vobizNumberId: mapping.vobizNumberId ?? null,
    label: mapping.label ?? "",
    status: mapping.status,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}

export async function listAdminPhoneNumbers(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = String(req.query.organizationId ?? "").trim();
    const filter: Record<string, unknown> = {};
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    const mappings = await OrgPhoneNumber.find(filter).sort({ createdAt: -1 }).lean();
    const orgIds = [...new Set(mappings.map((m) => String(m.organizationId)))];
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("name")
      .lean();
    const orgNames = new Map(orgs.map((org) => [String(org._id), org.name]));

    res.json({
      phoneNumbers: mappings.map((mapping) =>
        serialize(mapping, orgNames.get(String(mapping.organizationId)))
      ),
    });
  } catch (err) {
    console.error("Failed to list phone numbers:", err);
    res.status(500).json({ error: "Failed to list phone numbers" });
  }
}

export async function createAdminPhoneNumber(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = String(req.body?.organizationId ?? "").trim();
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    const label = String(req.body?.label ?? "").trim();
    const vobizNumberId = String(req.body?.vobizNumberId ?? "").trim() || null;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({ error: "A valid organizationId is required" });
      return;
    }
    if (!phoneNumber || phoneNumber.length < 8) {
      res.status(400).json({ error: "A valid phone number is required" });
      return;
    }

    const organization = await Organization.findById(organizationId).select("name").lean();
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const existing = await OrgPhoneNumber.findOne({ phoneNumber }).lean();
    if (existing) {
      res.status(409).json({ error: "This phone number is already assigned" });
      return;
    }

    const mapping = await OrgPhoneNumber.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      phoneNumber,
      label,
      vobizNumberId,
      status: "active",
      createdBy: authReq.user?.id ?? null,
    });

    res.status(201).json({ phoneNumber: serialize(mapping, organization.name) });
  } catch (err) {
    console.error("Failed to create phone number:", err);
    res.status(500).json({ error: "Failed to assign phone number" });
  }
}

export async function updateAdminPhoneNumber(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid phone number id" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (req.body?.status === "active" || req.body?.status === "disabled") {
      update.status = req.body.status;
    }
    if (typeof req.body?.label === "string") update.label = req.body.label.trim();
    if (typeof req.body?.vobizNumberId === "string") {
      update.vobizNumberId = req.body.vobizNumberId.trim() || null;
    }

    const mapping = await OrgPhoneNumber.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!mapping) {
      res.status(404).json({ error: "Phone number not found" });
      return;
    }
    res.json({ phoneNumber: serialize(mapping) });
  } catch (err) {
    console.error("Failed to update phone number:", err);
    res.status(500).json({ error: "Failed to update phone number" });
  }
}

export async function deleteAdminPhoneNumber(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid phone number id" });
      return;
    }
    const deleted = await OrgPhoneNumber.findByIdAndDelete(id).lean();
    if (!deleted) {
      res.status(404).json({ error: "Phone number not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete phone number:", err);
    res.status(500).json({ error: "Failed to delete phone number" });
  }
}
