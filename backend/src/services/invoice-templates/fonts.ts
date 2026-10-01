import path from "node:path";
import { Font } from "@react-pdf/renderer";

const FONTS_DIR = path.join(import.meta.dir, "..", "..", "assets", "fonts");
const font = (file: string) => path.join(FONTS_DIR, file);

export const FONT = {
  sans: "IBM Plex Sans",
  mono: "IBM Plex Mono",
  serif: "Newsreader",
} as const;

// react-pdf hyphenates English words by default, which splits company names
// and email addresses ("Premi-um", "Pvt.\nLtd."). This is a global setting, so
// it also applies to the other react-pdf documents (email PDFs).
Font.registerHyphenationCallback((word) => [word]);

Font.register({
  family: FONT.sans,
  fonts: [
    { src: font("IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: font("IBMPlexSans-Medium.ttf"), fontWeight: 500 },
    { src: font("IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
  ],
});

Font.register({
  family: FONT.mono,
  fonts: [
    { src: font("IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: font("IBMPlexMono-Medium.ttf"), fontWeight: 500 },
    { src: font("IBMPlexMono-SemiBold.ttf"), fontWeight: 600 },
  ],
});

Font.register({
  family: FONT.serif,
  fonts: [
    { src: font("Newsreader-Regular.ttf"), fontWeight: 400 },
    { src: font("Newsreader-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: font("Newsreader-Medium.ttf"), fontWeight: 500 },
    { src: font("Newsreader-SemiBold.ttf"), fontWeight: 600 },
  ],
});
