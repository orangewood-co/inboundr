import type { Request, Response } from "express";
import mongoose from "mongoose";
import { ShortLink, type ShortLinkStatus, type ShortLinkTrackingMode } from "../models/short-link.model";
import { ShortLinkEvent } from "../models/short-link-event.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  getBlockResult,
  hashPassword,
  makeShortCode,
  normalizeDestinationUrl,
  normalizeShortCode,
  normalizeTrackingMode,
  recordLinkEvent,
  verifyPassword,
} from "../services/short-link.service";

const embedOrigin = process.env.EMBED_ORIGIN ?? "http://localhost:5175";

function parseNullableDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateExpiry(expiresAt: Date | null): string | null {
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return "Expiry must be in the future";
  }
  return null;
}

function parseNullablePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function serializeLink(link: any) {
  return {
    ...link,
    hasPassword: Boolean(link.passwordHash),
    passwordHash: undefined,
    passwordSalt: undefined,
  };
}

function normalizeInput(body: Record<string, unknown>, fallbackCode?: string) {
  const destinationUrl = normalizeDestinationUrl(body.destinationUrl);
  const customCode = normalizeShortCode(String(body.code ?? ""));
  const password = String(body.password ?? "");
  const passwordFields = password ? hashPassword(password) : null;

  return {
    destinationUrl,
    code: customCode || fallbackCode || makeShortCode(),
    title: String(body.title ?? "").trim().slice(0, 160) || null,
    status: (body.status === "disabled" ? "disabled" : "active") as ShortLinkStatus,
    trackingMode: normalizeTrackingMode(body.trackingMode) as ShortLinkTrackingMode,
    expiresAt: parseNullableDate(body.expiresAt),
    maxViews: parseNullablePositiveInt(body.maxViews),
    ...(passwordFields ? { passwordHash: passwordFields.hash, passwordSalt: passwordFields.salt } : {}),
  };
}

export async function listLinks(req: Request, res: Response): Promise<void> {
  try {
    const { organization } = req as OrganizationRequest;
    const links = await ShortLink.find({ organizationId: organization._id, status: { $ne: "archived" } })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ links: links.map(serializeLink) });
  } catch (err) {
    console.error("Error listing links:", err);
    res.status(500).json({ error: "Failed to fetch links" });
  }
}

export async function createLink(req: Request, res: Response): Promise<void> {
  try {
    const { organization, user } = req as OrganizationRequest;
    const input = normalizeInput(req.body ?? {});
    if (!input.destinationUrl) {
      res.status(400).json({ error: "A valid HTTP or HTTPS destination URL is required" });
      return;
    }
    const destinationUrl = input.destinationUrl;
    if (!input.code || input.code.length < 3) {
      res.status(400).json({ error: "Short code must be at least 3 characters" });
      return;
    }
    const expiryError = validateExpiry(input.expiresAt);
    if (expiryError) {
      res.status(400).json({ error: expiryError });
      return;
    }

    const link = await ShortLink.create({
      ...input,
      destinationUrl,
      organizationId: organization._id,
      createdByUserId: user.id,
    });
    res.status(201).json(serializeLink(link.toJSON()));
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "A link with this short code already exists" });
      return;
    }
    console.error("Error creating link:", err);
    res.status(500).json({ error: "Failed to create link" });
  }
}

export async function getLink(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const link = await ShortLink.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!link || link.status === "archived") {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json(serializeLink(link));
  } catch (err) {
    console.error("Error fetching link:", err);
    res.status(500).json({ error: "Failed to fetch link" });
  }
}

export async function updateLink(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }
    const input = normalizeInput(req.body ?? {});
    if (!input.destinationUrl) {
      res.status(400).json({ error: "A valid HTTP or HTTPS destination URL is required" });
      return;
    }
    const expiryError = validateExpiry(input.expiresAt);
    if (expiryError) {
      res.status(400).json({ error: expiryError });
      return;
    }
    const body = req.body ?? {};
    const update: Record<string, unknown> = { ...input };
    if (body.clearPassword) {
      update.passwordHash = null;
      update.passwordSalt = null;
    }
    if (!String(body.password ?? "")) {
      delete update.passwordHash;
      delete update.passwordSalt;
    }

    const { organization } = req as OrganizationRequest;
    const link = await ShortLink.findOneAndUpdate(
      { _id: id, organizationId: organization._id, status: { $ne: "archived" } },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json(serializeLink(link));
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "A link with this short code already exists" });
      return;
    }
    console.error("Error updating link:", err);
    res.status(500).json({ error: "Failed to update link" });
  }
}

export async function archiveLink(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const link = await ShortLink.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { status: "archived" },
      { new: true }
    ).lean();
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error archiving link:", err);
    res.status(500).json({ error: "Failed to archive link" });
  }
}

export async function listLinkEvents(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid link id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const link = await ShortLink.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 250);
    const events = await ShortLinkEvent.find({ linkId: link._id, organizationId: organization._id })
      .sort({ openedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ events });
  } catch (err) {
    console.error("Error listing link events:", err);
    res.status(500).json({ error: "Failed to fetch link events" });
  }
}

export async function redirectShortLink(req: Request, res: Response): Promise<void> {
  try {
    const code = normalizeShortCode(String(req.params.code ?? ""));
    const link = await ShortLink.findOne({ code }).select("+passwordHash +passwordSalt");
    if (!link) {
      recordLinkEvent(req, "not_found", null);
      res.status(404).send("Link not found");
      return;
    }
    const blockResult = getBlockResult(link);
    if (blockResult) {
      recordLinkEvent(req, blockResult, link);
      res.status(blockResult === "expired" || blockResult === "view_limit_reached" ? 410 : 404).send("Link unavailable");
      return;
    }
    if (link.passwordHash || link.trackingMode === "precise_location") {
      recordLinkEvent(req, link.passwordHash ? "password_required" : "precise_location_required", link);
      res.redirect(302, `${embedOrigin}/l/${encodeURIComponent(code)}`);
      return;
    }
    const updated = await ShortLink.findOneAndUpdate(
      {
        _id: link._id,
        status: "active",
        $and: [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
          { $or: [{ maxViews: null }, { $expr: { $lt: ["$viewCount", "$maxViews"] } }] },
        ],
      },
      { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
      { new: true }
    );
    if (!updated) {
      recordLinkEvent(req, "view_limit_reached", link);
      res.status(410).send("Link unavailable");
      return;
    }
    recordLinkEvent(req, "redirected", updated);
    res.redirect(302, updated.destinationUrl);
  } catch (err) {
    console.error("Error redirecting link:", err);
    res.status(500).send("Unable to redirect link");
  }
}

export async function checkPublicLink(req: Request, res: Response): Promise<void> {
  const code = normalizeShortCode(String(req.params.code ?? ""));
  const link = await ShortLink.findOne({ code }).lean();
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }
  const blockResult = getBlockResult(link as any);
  if (blockResult) {
    res.status(410).json({ error: "Link unavailable", result: blockResult });
    return;
  }
  res.json({
    code: link.code,
    title: link.title,
    requiresPassword: Boolean(link.passwordHash),
    requiresPreciseLocation: link.trackingMode === "precise_location",
  });
}

export async function unlockPublicLink(req: Request, res: Response): Promise<void> {
  const code = normalizeShortCode(String(req.params.code ?? ""));
  const link = await ShortLink.findOne({ code });
  if (!link) {
    recordLinkEvent(req, "not_found", null);
    res.status(404).json({ error: "Link not found" });
    return;
  }
  const blockResult = getBlockResult(link);
  if (blockResult) {
    recordLinkEvent(req, blockResult, link);
    res.status(410).json({ error: "Link unavailable", result: blockResult });
    return;
  }
  if (link.passwordHash && link.passwordSalt && !verifyPassword(String(req.body?.password ?? ""), link.passwordSalt, link.passwordHash)) {
    recordLinkEvent(req, "password_failed", link);
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  if (link.trackingMode === "precise_location") {
    res.json({ requiresPreciseLocation: true });
    return;
  }
  await finishPublicRedirect(req, res, link._id);
}

export async function trackLocationAndRedirect(req: Request, res: Response): Promise<void> {
  const code = normalizeShortCode(String(req.params.code ?? ""));
  const link = await ShortLink.findOne({ code });
  if (!link) {
    recordLinkEvent(req, "not_found", null);
    res.status(404).json({ error: "Link not found" });
    return;
  }
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    res.status(400).json({ error: "Location is required" });
    return;
  }
  await finishPublicRedirect(req, res, link._id, {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(req.body?.accuracy)) ? Number(req.body?.accuracy) : null,
  });
}

async function finishPublicRedirect(req: Request, res: Response, linkId: mongoose.Types.ObjectId, precise?: { latitude: number; longitude: number; accuracy?: number | null }) {
  const updated = await ShortLink.findOneAndUpdate(
    {
      _id: linkId,
      status: "active",
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        { $or: [{ maxViews: null }, { $expr: { $lt: ["$viewCount", "$maxViews"] } }] },
      ],
    },
    { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    res.status(410).json({ error: "Link unavailable" });
    return;
  }
  recordLinkEvent(req, "redirected", updated, precise);
  res.json({ destinationUrl: updated.destinationUrl });
}
