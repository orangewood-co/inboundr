// One-off helper to download static TTF instances of the embed app's and the
// invoice PDF templates' fonts from the Google Fonts CSS API (legacy user
// agents receive truetype URLs). File keys are the weight, suffixed with "i"
// for italic instances.
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(import.meta.dir, "..", "src", "assets", "fonts");

const FAMILIES: { css: string; files: Record<string, string> }[] = [
  {
    css: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700",
    files: { "400": "BricolageGrotesque-Regular.ttf", "700": "BricolageGrotesque-Bold.ttf" },
  },
  {
    css: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;700",
    files: { "400": "HankenGrotesk-Regular.ttf", "700": "HankenGrotesk-Bold.ttf" },
  },
  {
    css: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600",
    files: { "400": "IBMPlexSans-Regular.ttf", "500": "IBMPlexSans-Medium.ttf", "600": "IBMPlexSans-SemiBold.ttf" },
  },
  {
    css: "https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400",
    files: {
      "400": "Newsreader-Regular.ttf",
      "500": "Newsreader-Medium.ttf",
      "600": "Newsreader-SemiBold.ttf",
      "400i": "Newsreader-Italic.ttf",
    },
  },
];

// Google's build of IBM Plex Mono has a space glyph that crashes fontkit
// (react-pdf), so it comes straight from IBM's release files instead.
const DIRECT_FILES: Record<string, string> = Object.fromEntries(
  ["Regular", "Medium", "SemiBold"].map((weight) => [
    `IBMPlexMono-${weight}.ttf`,
    `https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/ttf/IBMPlexMono-${weight}.ttf`,
  ])
);

await mkdir(OUT_DIR, { recursive: true });

for (const [fileName, url] of Object.entries(DIRECT_FILES)) {
  const fontRes = await fetch(url);
  if (!fontRes.ok) throw new Error(`Font fetch failed (${fontRes.status}) for ${url}`);
  const data = await fontRes.arrayBuffer();
  await Bun.write(path.join(OUT_DIR, fileName), data);
  console.log(`saved ${fileName} (${data.byteLength} bytes)`);
}

for (const family of FAMILIES) {
  // No modern UA header: the CSS API then serves format('truetype') sources.
  const res = await fetch(family.css, { headers: { "User-Agent": "curl/8.0" } });
  if (!res.ok) throw new Error(`CSS fetch failed (${res.status}) for ${family.css}`);
  const css = await res.text();

  const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
  for (const block of blocks) {
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const italic = /font-style:\s*italic/.test(block);
    const url = block.match(/url\((https:[^)]+)\)/)?.[1];
    if (!weight || !url) continue;
    const fileName = family.files[italic ? `${weight}i` : weight];
    if (!fileName) continue;

    const fontRes = await fetch(url);
    if (!fontRes.ok) throw new Error(`Font fetch failed (${fontRes.status}) for ${url}`);
    const data = await fontRes.arrayBuffer();
    await Bun.write(path.join(OUT_DIR, fileName), data);
    console.log(`saved ${fileName} (${data.byteLength} bytes)`);
  }
}
