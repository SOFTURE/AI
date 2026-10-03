import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { BrandColors } from "../../src/config/colors.js";
import type { BrandFont } from "../../src/config/config.js";
import { loadOgFonts, type OgFonts } from "../../src/og/fonts.js";

const require = createRequire(import.meta.url);

/** Inter from the `@fontsource/inter` dev dependency (OFL-1.1): one file per weight, latin subset. */
export function getInterFile(weight: 400 | 700, format: "woff" | "woff2" = "woff"): string {
  return require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.${format}`);
}

export function makeFont(files: { path: string; weight: string; style?: "normal" | "italic" }[], family = "Inter"): BrandFont {
  return { family, fallback: "sans-serif", files: files.map((file) => ({ style: "normal", unicodeRange: null, ...file })) };
}

export const INTER: BrandFont = makeFont([
  { path: getInterFile(400), weight: "400" },
  { path: getInterFile(700), weight: "700" },
]);

export function loadInter(): OgFonts {
  const loaded = loadOgFonts({ heading: INTER, body: INTER });
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value;
}

export const COLORS: BrandColors = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#0f766e",
};

export const LOGO_SVG = readFileSync(new URL("../../examples/fixture/brand/mark.svg", import.meta.url), "utf8");

/** Width and height from a PNG's IHDR chunk. */
export function readPngSize(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Data for every template, the snapshots' content. */
export const SAMPLE_DATA: Record<string, unknown> = {
  "headline-cta": {
    eyebrow: "Retirement calculator",
    headline: "Stop working at 49",
    cta: "Count your date",
    tiles: [
      { label: "Exit age", value: "49" },
      { label: "Saved", value: "$412k" },
      { label: "Years left", value: "13" },
    ],
  },
  "headline-chart": {
    eyebrow: "Your savings",
    headline: "Free by March 2040",
    chart: {
      viewBox: [100, 50],
      paths: [
        { d: "M0 50 L0 42 L25 36 L50 26 L75 14 L100 4 L100 50 Z", tone: "accent", fill: true },
        { d: "M0 42 L25 36 L50 26 L75 14 L100 4", tone: "accent" },
        { d: "M0 30 L100 30", tone: "muted", strokeWidth: 0.5 },
      ],
    },
    tiles: [{ label: "Exit age", value: "49" }],
  },
};
