import type { ComposeFont } from "./compose.js";

/** HTML helpers shared by the compositions (the screen film's and the footage film's). */

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const FONT_FORMATS: Record<string, string> = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };

function getFontFormat(src: string): string {
  const extension = src.split(".").at(-1)?.toLowerCase() ?? "";
  const format = FONT_FORMATS[extension];
  if (format === undefined) throw new Error(`Font ${src}: expected a .woff2, .woff, .ttf or .otf file.`);
  return format;
}

export function fontFaces(font: ComposeFont | null): string[] {
  if (font === null) return [];
  return font.faces.map((face) => {
    const range = face.unicodeRange === null ? "" : `;unicode-range:${face.unicodeRange}`;
    return `@font-face{font-family:"${font.family}";src:url("${face.src}") format("${getFontFormat(face.src)}");font-weight:${face.weight};font-style:${face.style}${range}}`;
  });
}

export function fontStack(font: ComposeFont | null, fallback: string): string {
  return font === null ? fallback : `"${font.family}",${font.fallback}`;
}
