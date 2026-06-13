import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Auth for service-to-service endpoints (voice agent worker).
 * Requires the x-internal-key header to match VOICE_INTERNAL_API_KEY.
 */
export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.VOICE_INTERNAL_API_KEY ?? "";
  const provided = req.header("x-internal-key") ?? "";

  if (!expected) {
    res.status(503).json({ error: "Internal API is not configured" });
    return;
  }

  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const providedHash = crypto.createHash("sha256").update(provided).digest();

  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
