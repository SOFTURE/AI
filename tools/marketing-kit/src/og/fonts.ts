import { readFileSync } from "node:fs";
import { extname } from "node:path";

import type { BrandFont } from "../config/config.js";
import { formatIssuePath } from "../config/issues.js";
import { loadCharacterMap } from "./character-map.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * Brand fonts for Satori. Satori parses only static `.ttf`, `.otf` and `.woff` files and, when a
 * weight is missing, silently draws another one, so a card could ask for bold and get regular. Here
 * `.woff2` and variable ranges are refused, and templates pick their weights from the loaded set
 * (`pickWeight`), so a tree only ever names a weight that is loaded. Each file's character map is
 * read here too, so a file Satori could not draw text from is refused by its JSON path.
 */

export const OG_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export type OgFontWeight = (typeof OG_FONT_WEIGHTS)[number];

export const OG_FONT_KINDS = ["heading", "body"] as const;

export type OgFontKind = (typeof OG_FONT_KINDS)[number];

const SUPPORTED_EXTENSIONS = [".ttf", ".otf", ".woff"];

/** A font file as Satori takes it. */
export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: OgFontWeight;
  style: "normal" | "italic";
}

/**
 * A family a template writes in, with the upright weights that are loaded for it. Satori uses one
 * file per family, weight and style, so the second and later files of a weight and style (subset
 * files such as `latin-ext` next to `latin`) are registered as families of their own, `<family> #2`
 * and so on, listed in `subsetFamilies`; a template names them after the family (`toFontFamilyCss`).
 */
export interface OgFontFamily {
  family: string;
  weights: OgFontWeight[];
  subsetFamilies: string[];
}

export interface OgFonts {
  satoriFonts: SatoriFont[];
  heading: OgFontFamily;
  body: OgFontFamily;
}

export type ReadFontFile = (path: string) => Buffer;

function isOgFontWeight(value: number): value is OgFontWeight {
  return OG_FONT_WEIGHTS.some((weight) => weight === value);
}

/** The loaded weight nearest to `wish`; a tie goes to the heavier one. */
export function pickWeight(loaded: readonly OgFontWeight[], wish: OgFontWeight): OgFontWeight {
  let best = loaded[0] ?? wish;
  for (const weight of loaded) {
    const distance = Math.abs(weight - wish);
    const bestDistance = Math.abs(best - wish);
    if (distance < bestDistance || (distance === bestDistance && weight > best)) best = weight;
  }
  return best;
}

/** The name Satori gets for the `position`-th file (from 1) of a weight and style of `family`. */
function getSubsetFamilyName(family: string, position: number): string {
  return position === 1 ? family : `${family} #${position}`;
}

/** The CSS `font-family` of a family: the family, then its subset families in order. */
export function toFontFamilyCss(family: OgFontFamily): string {
  return [family.family, ...family.subsetFamilies].join(", ");
}

function loadFamily(kind: OgFontKind, font: BrandFont, read: ReadFontFile): OgResult<{ fonts: SatoriFont[]; family: OgFontFamily }> {
  const fonts: SatoriFont[] = [];
  const subsetFamilies: string[] = [];
  const positions = new Map<string, number>();
  for (const [index, file] of font.files.entries()) {
    const at = formatIssuePath(["brand", "fonts", kind, "files", index]);
    if (!SUPPORTED_EXTENSIONS.includes(extname(file.path).toLowerCase())) {
      return err(`OG images: ${at} is ${extname(file.path)}; Satori reads only .ttf, .otf and .woff files.`);
    }
    const weight = Number(file.weight);
    if (!isOgFontWeight(weight)) {
      return err(`OG images: ${at} has weight "${file.weight}"; Satori needs one static weight from 100 to 900 in steps of 100.`);
    }
    let data: Buffer;
    try {
      data = read(file.path);
    } catch (error) {
      return err(`OG images: reading the font ${file.path} (${at}): ${(error as NodeJS.ErrnoException).code ?? String(error)}.`);
    }
    const characters = loadCharacterMap(data);
    if (!characters.ok) return err(`OG images: ${at} (${file.path}) has no readable character map: ${characters.error}.`);
    const group = `${weight} ${file.style}`;
    const position = (positions.get(group) ?? 0) + 1;
    positions.set(group, position);
    const name = getSubsetFamilyName(font.family, position);
    if (position > 1 && !subsetFamilies.includes(name)) subsetFamilies.push(name);
    fonts.push({ name, data, weight, style: file.style });
  }
  const weights = [...new Set(fonts.filter((entry) => entry.style === "normal").map((entry) => entry.weight))].sort((a, b) => a - b);
  return ok({ fonts, family: { family: font.family, weights, subsetFamilies } });
}

/**
 * Loads the brand's heading and body fonts. A missing kind borrows the other one; a kind without an
 * upright file is refused, because every template writes upright text.
 */
export function loadOgFonts(fonts: { heading: BrandFont | null; body: BrandFont | null }, read: ReadFontFile = readFileSync): OgResult<OgFonts> {
  const satoriFonts: SatoriFont[] = [];
  const families: Partial<Record<OgFontKind, OgFontFamily>> = {};
  for (const kind of OG_FONT_KINDS) {
    const font = fonts[kind];
    if (font === null || font.files.length === 0) continue;
    const loaded = loadFamily(kind, font, read);
    if (!loaded.ok) return loaded;
    if (loaded.value.family.weights.length === 0) {
      return err(`OG images: brand.fonts.${kind} has no upright (style "normal") file; add one.`);
    }
    satoriFonts.push(...loaded.value.fonts);
    families[kind] = loaded.value.family;
  }
  const heading = families.heading ?? families.body;
  const body = families.body ?? families.heading;
  if (heading === undefined || body === undefined) {
    return err("OG images need at least one .ttf, .otf or .woff file in brand.fonts.heading or brand.fonts.body.");
  }
  return ok({ satoriFonts, heading, body });
}
