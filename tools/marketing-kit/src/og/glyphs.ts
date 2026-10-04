import { loadCharacterMap, type CharacterMap } from "./character-map.js";
import type { OgNode } from "./element.js";
import type { SatoriFont } from "./fonts.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * Characters a card would draw without a glyph. Satori draws nothing (or `.notdef`) for them and
 * reports no error, so the check runs on the element tree before layout, with Satori's own font
 * choice: for a text run it takes one font per family (the best weight and style, the first loaded
 * file on a tie), the families named in `fontFamily` first, in their order, then every loaded family
 * in load order. A character goes to the first of those fonts that maps it. When that font is one
 * of the named families (a subset family of the text's own) but not at the weight and style of the
 * text's own font, Satori would draw it lighter or heavier than its line, so it counts as missing too.
 */

/** Characters that draw nothing by design: whitespace, control and format characters, variation selectors. */
const INVISIBLE_PATTERN = /^[\p{White_Space}\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]$/u;

/** Satori's default when no ancestor sets a font: the family is not loaded, so every family is a fallback. */
const DEFAULT_FONT_STYLE: TextFontStyle = { families: ["serif"], weight: 400, style: "normal" };

interface TextFontStyle {
  /** The `fontFamily` names, lowercased, as Satori splits them. */
  families: string[];
  weight: number;
  style: string;
}

/** A font Satori would try for a text, and whether its family is named in the text's `fontFamily`. */
interface Candidate {
  font: SatoriFont;
  map: CharacterMap;
  isRequested: boolean;
}

/**
 * A text the tree draws and the characters it cannot draw at its own weight and style, unique and in
 * order; a text drawn twice is listed once.
 */
export interface MissingGlyphs {
  text: string;
  characters: string[];
}

/**
 * Whether `candidate` beats `best` for a wished weight and style: a port of Satori 0.35's font
 * comparator. An exact weight wins; 400 and 500 stand in for each other; below 400 lighter weights
 * come first, otherwise heavier ones; the style only breaks a weight tie, and a full tie keeps `best`.
 */
function isBetterFont(wish: { weight: number; style: string }, best: SatoriFont, candidate: SatoriFont): boolean {
  const target = wish.weight;
  const current = best.weight;
  const next = candidate.weight;
  if (current !== next) {
    if (current === target) return false;
    if (next === target) return true;
    if (target === 400 && current === 500) return false;
    if (target === 500 && current === 400) return false;
    if (target === 400 && next === 500) return true;
    if (target === 500 && next === 400) return true;
    if (target < 400) {
      if (current < target && next < target) return next > current;
      if (current < target) return false;
      if (next < target) return true;
      return next < current;
    }
    if (target < current && target < next) return next < current;
    if (target < current) return false;
    if (target < next) return true;
    return next > current;
  }
  return best.style !== wish.style && candidate.style === wish.style;
}

/** The file Satori uses for a family at a weight and style. */
export function selectSatoriFont(files: readonly SatoriFont[], wish: { weight: number; style: string }): SatoriFont | undefined {
  let best = files[0];
  for (const candidate of files.slice(1)) {
    if (best !== undefined && isBetterFont(wish, best, candidate)) best = candidate;
  }
  return best;
}

function groupByFamily(fonts: readonly SatoriFont[]): Map<string, SatoriFont[]> {
  const families = new Map<string, SatoriFont[]>();
  for (const font of fonts) {
    const key = font.name.toLowerCase();
    families.set(key, [...(families.get(key) ?? []), font]);
  }
  return families;
}

function parseWeight(value: unknown, inherited: number): number {
  if (value === "normal") return 400;
  if (value === "bold") return 700;
  if (typeof value === "number") return value;
  if (typeof value === "string" && Number.isFinite(Number.parseInt(value, 10))) return Number.parseInt(value, 10);
  return inherited;
}

/** Satori's split of a CSS `font-family`: by comma, trimmed, one surrounding quote stripped at each end, lowercased. */
export function parseFontFamily(value: string): string[] {
  return value.split(",").map((name) => {
    let trimmed = name.trim();
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('"') || trimmed.endsWith("'")) trimmed = trimmed.slice(0, -1);
    return trimmed.toLocaleLowerCase();
  });
}

function inheritFontStyle(node: OgNode, parent: TextFontStyle): TextFontStyle {
  const style = node.props.style ?? {};
  return {
    families: typeof style.fontFamily === "string" ? parseFontFamily(style.fontFamily) : parent.families,
    weight: parseWeight(style.fontWeight, parent.weight),
    style: typeof style.fontStyle === "string" ? style.fontStyle : parent.style,
  };
}

/** Every string child of the tree with the font style it inherits. */
function listTexts(node: OgNode, parent: TextFontStyle): { text: string; font: TextFontStyle }[] {
  const font = inheritFontStyle(node, parent);
  const children = node.props.children;
  const list = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return list.flatMap((child) => (typeof child === "string" ? [{ text: child, font }] : listTexts(child, font)));
}

/** The fonts Satori would try for a text, in its order: the named families, then every family. */
function getCandidates(families: Map<string, SatoriFont[]>, font: TextFontStyle): OgResult<Candidate[]> {
  const requested = font.families.filter((name) => families.has(name));
  const keys = [...requested.map((key) => ({ key, isRequested: true })), ...[...families.keys()].map((key) => ({ key, isRequested: false }))];
  const candidates: Candidate[] = [];
  for (const { key, isRequested } of keys) {
    const selected = selectSatoriFont(families.get(key) ?? [], font);
    if (selected === undefined) continue;
    const map = loadCharacterMap(selected.data);
    if (!map.ok) return err(`the font "${selected.name}" ${selected.weight} ${selected.style}: ${map.error}`);
    candidates.push({ font: selected, map: map.value, isRequested });
  }
  return ok(candidates);
}

/** Whether Satori draws the code point at the text's own weight and style (that of its first named family). */
function isDrawnInStyle(candidates: readonly Candidate[], codePoint: number): boolean {
  const drawing = candidates.find((candidate) => candidate.map.has(codePoint));
  if (drawing === undefined) return false;
  const own = candidates[0];
  if (!drawing.isRequested || own === undefined || !own.isRequested) return true;
  return drawing.font.weight === own.font.weight && drawing.font.style === own.font.style;
}

/** Texts of the tree with characters none of the fonts Satori would try can draw. */
export function findMissingGlyphs(tree: OgNode, fonts: readonly SatoriFont[]): OgResult<MissingGlyphs[]> {
  const families = groupByFamily(fonts);
  const missing: MissingGlyphs[] = [];
  for (const { text, font } of listTexts(tree, DEFAULT_FONT_STYLE)) {
    const candidates = getCandidates(families, font);
    if (!candidates.ok) return candidates;
    const characters = new Set<string>();
    for (const character of text) {
      if (INVISIBLE_PATTERN.test(character)) continue;
      if (!isDrawnInStyle(candidates.value, character.codePointAt(0) ?? 0)) characters.add(character);
    }
    const listed = missing.find((entry) => entry.text === text);
    if (listed !== undefined) listed.characters = [...new Set([...listed.characters, ...characters])];
    else if (characters.size > 0) missing.push({ text, characters: [...characters] });
  }
  return ok(missing);
}

/** `"\u0105" (U+0105)`: the character and its code point, readable when the character itself is not. */
export function describeCharacter(character: string): string {
  const codePoint = character.codePointAt(0) ?? 0;
  return `"${character}" (U+${codePoint.toString(16).toUpperCase().padStart(4, "0")})`;
}
