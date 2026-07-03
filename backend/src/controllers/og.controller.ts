import type { Request, Response } from "express";
import { Form } from "../models/form.model";
import { renderFallbackOgImage, renderFormOgImage } from "../services/og-image.service";

const MEMO_LIMIT = 200;
const memo = new Map<string, Buffer>();

let fallbackPromise: Promise<Buffer> | null = null;

function getFallbackImage(): Promise<Buffer> {
  fallbackPromise ??= renderFallbackOgImage().catch((err) => {
    fallbackPromise = null;
    throw err;
  });
  return fallbackPromise;
}

function remember(key: string, png: Buffer): void {
  if (memo.size >= MEMO_LIMIT) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, png);
}

function sendPng(res: Response, png: Buffer, cacheControl: string): void {
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
}

// Short max-age so a slug that gets published later isn't shadowed by a
// cached generic card.
async function sendFallback(res: Response): Promise<void> {
  sendPng(res, await getFallbackImage(), "public, max-age=300");
}

export async function getFormOgImage(req: Request, res: Response): Promise<void> {
  try {
    const form = await Form.findOne({ slug: req.params.slug, status: "published" }).lean();
    if (!form) {
      await sendFallback(res);
      return;
    }

    const key = `${form.slug}:${new Date(form.updatedAt).getTime()}`;
    let png = memo.get(key);
    if (!png) {
      png = await renderFormOgImage({
        title: form.title,
        description: form.description,
        fieldCount: form.fields.length,
        branding: form.branding,
      });
      remember(key, png);
    }

    sendPng(res, png, "public, max-age=3600, s-maxage=86400");
  } catch (err) {
    console.error("Failed to render form OG image:", err);
    try {
      await sendFallback(res);
    } catch {
      res.status(500).json({ error: "Failed to render OG image" });
    }
  }
}
