import type { Request, Response } from "express";
import { Form } from "../models/form.model";
import { apiOrigin, embedOrigin, formsShareOrigin } from "../config/origins.config";
import { renderFallbackOgImage, renderFormOgImage } from "../services/og-image.service";
import { resolvePublicImageUrl } from "../services/storage.service";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Serves the share page for a form: crawlers read the OG tags from this HTML
// (they never execute JS), while browsers immediately continue to the embed
// form page. og:url self-references the share URL so crawlers don't re-scrape
// the tag-less embed SPA as the canonical page.
export async function getFormSharePage(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug ?? "");
  const form = await Form.findOne({ slug, status: "published" })
    .select("slug title description updatedAt")
    .lean()
    .catch(() => null);

  const targetUrl = `${embedOrigin}/form/${encodeURIComponent(slug)}`;
  const title = form ? form.title : "Inboundr Form";
  const description =
    form?.description ?? "Fill out this form — it only takes a moment.";
  const imageUrl = form
    ? `${apiOrigin}/api/v1/og/forms/${encodeURIComponent(form.slug)}.png?v=${new Date(form.updatedAt).getTime()}`
    : `${apiOrigin}/api/v1/og/forms/${encodeURIComponent(slug)}.png`;
  const shareUrl = `${formsShareOrigin}/f/${encodeURIComponent(slug)}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Inboundr" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="robots" content="noindex" />
    <script>location.replace(${JSON.stringify(targetUrl)} + location.search);</script>
  </head>
  <body>
    <p>Redirecting… <a href="${escapeHtml(targetUrl)}">Continue to the form</a></p>
  </body>
</html>`;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
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
        branding: {
          ...form.branding,
          logoUrl: await resolvePublicImageUrl(form.branding?.logoUrl),
        },
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
