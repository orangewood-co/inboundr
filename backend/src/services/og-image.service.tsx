import { readFile } from "node:fs/promises";
import path from "node:path";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";

export interface OgFormData {
  title: string;
  description: string | null;
  fieldCount: number;
  branding: {
    accentColor: string;
    logoUrl: string | null;
    backgroundType: "solid" | "gradient" | "none";
    backgroundColor: string | null;
    backgroundGradient: string | null;
  };
}

const WIDTH = 1200;
const HEIGHT = 630;

const FONTS_DIR = path.join(import.meta.dir, "..", "assets", "fonts");

let fontsPromise: Promise<SatoriOptions["fonts"]> | null = null;


function loadFonts(): Promise<SatoriOptions["fonts"]> {
  fontsPromise ??= Promise.all([
    readFile(path.join(FONTS_DIR, "BricolageGrotesque-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "BricolageGrotesque-Bold.ttf")),
    readFile(path.join(FONTS_DIR, "HankenGrotesk-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "HankenGrotesk-Bold.ttf")),
  ]).then(([bricolageRegular, bricolageBold, hankenRegular, hankenBold]) => [
    { name: "Bricolage Grotesque", data: bricolageRegular, weight: 400, style: "normal" },
    { name: "Bricolage Grotesque", data: bricolageBold, weight: 700, style: "normal" },
    { name: "Hanken Grotesk", data: hankenRegular, weight: 400, style: "normal" },
    { name: "Hanken Grotesk", data: hankenBold, weight: 700, style: "normal" },
  ]);
  return fontsPromise;
}

// Satori throws on glyphs missing from the provided fonts (emoji in
// particular), so strip pictographs rather than failing the whole card.
function sanitizeText(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLogoDataUrl(logoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const data = await res.arrayBuffer();
    if (data.byteLength === 0 || data.byteLength > 5 * 1024 * 1024) return null;
    return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
  } catch {
    return null;
  }
}

function cardBackground(branding: OgFormData["branding"]): string {
  if (branding.backgroundType === "gradient" && branding.backgroundGradient) {
    return branding.backgroundGradient;
  }
  if (branding.backgroundType === "solid" && branding.backgroundColor) {
    return branding.backgroundColor;
  }
  return "#ffffff";
}

async function renderPng(element: React.ReactNode): Promise<Buffer> {
  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
}

export async function renderFormOgImage(form: OgFormData): Promise<Buffer> {
  const accent = form.branding.accentColor || "#111827";
  const title = sanitizeText(form.title) || "Untitled form";
  const description = form.description ? sanitizeText(form.description) : null;
  const logoDataUrl = form.branding.logoUrl
    ? await fetchLogoDataUrl(form.branding.logoUrl)
    : null;

  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const questionLabel = `${form.fieldCount} ${form.fieldCount === 1 ? "question" : "questions"}`;

  return renderPng(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: cardBackground(form.branding),
        padding: "60px 100px",
        position: "relative",
      }}
    >
      {logoDataUrl ? (
        <img
          src={logoDataUrl}
          width={104}
          height={104}
          style={{
            borderRadius: 26,
            objectFit: "contain",
            marginBottom: 40,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
          }}
        />
      ) : (
        <div
          style={{
            width: 104,
            height: 104,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 26,
            backgroundColor: accent,
            color: "#ffffff",
            fontFamily: "Bricolage Grotesque",
            fontWeight: 700,
            fontSize: 40,
            marginBottom: 40,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
          }}
        >
          {initials}
        </div>
      )}

      {/* lineClamp only applies to display: block elements in satori */}
      <div
        style={{
          display: "block",
          fontFamily: "Bricolage Grotesque",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "#1c1917",
          textAlign: "center",
          maxWidth: 940,
          lineClamp: 2,
        }}
      >
        {title}
      </div>

      {description ? (
        <div
          style={{
            display: "block",
            fontFamily: "Hanken Grotesk",
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.45,
            color: "#78716c",
            textAlign: "center",
            maxWidth: 860,
            marginTop: 24,
            lineClamp: 2,
          }}
        >
          {description}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 44,
          padding: "16px 36px",
          borderRadius: 9999,
          backgroundColor: accent,
          color: "#ffffff",
          fontFamily: "Hanken Grotesk",
          fontWeight: 700,
          fontSize: 26,
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
        }}
      >
        {questionLabel}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 36,
          right: 48,
          display: "flex",
          fontFamily: "Bricolage Grotesque",
          fontWeight: 700,
          fontSize: 26,
          color: "rgba(28, 25, 23, 0.4)",
        }}
      >
        Inboundr
      </div>
    </div>,
  );
}

export async function renderFallbackOgImage(): Promise<Buffer> {
  return renderPng(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 26,
          backgroundColor: "#111827",
          color: "#ffffff",
          fontFamily: "Bricolage Grotesque",
          fontWeight: 700,
          fontSize: 44,
          marginBottom: 40,
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
        }}
      >
        In
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bricolage Grotesque",
          fontWeight: 700,
          fontSize: 68,
          letterSpacing: "-0.02em",
          color: "#1c1917",
        }}
      >
        Inboundr
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Hanken Grotesk",
          fontWeight: 400,
          fontSize: 30,
          color: "#78716c",
          marginTop: 20,
        }}
      >
        Share forms and collect responses
      </div>
    </div>,
  );
}
