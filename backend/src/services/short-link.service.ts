import crypto from "crypto";
import type { Request } from "express";
import type { IResult } from "ua-parser-js";
import { ShortLinkEvent, type ShortLinkEventResult } from "../models/short-link-event.model";
import type { IShortLink, ShortLinkTrackingMode } from "../models/short-link.model";

const UAParser: (ua: string) => IResult = require("ua-parser-js");
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function normalizeShortCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function makeShortCode(length = 7): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeDestinationUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeTrackingMode(value: unknown): ShortLinkTrackingMode {
  return value === "precise_location" ? "precise_location" : "standard";
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

export function isExpired(link: Pick<IShortLink, "expiresAt">): boolean {
  return Boolean(link.expiresAt && link.expiresAt.getTime() <= Date.now());
}

export function isViewLimitReached(link: Pick<IShortLink, "maxViews" | "viewCount">): boolean {
  return typeof link.maxViews === "number" && link.viewCount >= link.maxViews;
}

export function getBlockResult(link: Pick<IShortLink, "status" | "expiresAt" | "maxViews" | "viewCount">): ShortLinkEventResult | null {
  if (link.status !== "active") return "disabled";
  if (isExpired(link)) return "expired";
  if (isViewLimitReached(link)) return "view_limit_reached";
  return null;
}

function getClientIp(req: Request): string {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || req.socket.remoteAddress || "";
}

function hashIp(ip: string): string | null {
  if (!ip) return null;
  const secret = process.env.LINK_ANALYTICS_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "link-analytics";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

export function buildEventPayload(req: Request, result: ShortLinkEventResult, link?: IShortLink | null, precise?: { latitude: number; longitude: number; accuracy?: number | null }) {
  const rawUa = req.header("user-agent") || "";
  const parsed = rawUa ? UAParser(rawUa) : null;
  return {
    linkId: link?._id ?? null,
    organizationId: link?.organizationId ?? null,
    code: normalizeShortCode(String(req.params.code ?? link?.code ?? "")) || String(link?.code ?? ""),
    openedAt: new Date(),
    result,
    referrer: req.header("referer") || null,
    ipHash: hashIp(getClientIp(req)),
    userAgent: {
      raw: rawUa || null,
      browser: parsed?.browser.name ? [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ") : null,
      os: parsed?.os.name ? [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") : null,
      device: parsed?.device.type || "desktop",
    },
    approximateLocation: {
      country: req.header("cf-ipcountry") || null,
      region: null,
      city: null,
    },
    preciseLocation: {
      latitude: precise?.latitude ?? null,
      longitude: precise?.longitude ?? null,
      accuracy: precise?.accuracy ?? null,
    },
  };
}

export function recordLinkEvent(req: Request, result: ShortLinkEventResult, link?: IShortLink | null, precise?: { latitude: number; longitude: number; accuracy?: number | null }) {
  void ShortLinkEvent.create(buildEventPayload(req, result, link, precise)).catch((err) => {
    console.error("Failed to record short link event:", err);
  });
}
