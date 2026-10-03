import { loadCharacterMap, type CharacterMap } from "./character-map.js";
import type { OgNode } from "./element.js";
import type { SatoriFont } from "./fonts.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * Characters a card would draw without a glyph. Satori draws nothing (or `.notdef`) for them and
 * reports no error, so the check runs on the element tree before layout, with Satori's own font
 * choice: for a text run it takes one font per family (the best weight and style, the first loaded
 * file on a tie), the requested family first, then every loaded family in load order.
 */

/** Characters that draw nothing by design: whitespace, control and format characters, variation selectors. */
const INVISIBLE_PATTERN = /^[\p{White_Space}\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]$/u;

/** Satori's default when no ancestor sets a font: the family is not loaded, so every family is a fallback. */
const DEFAULT_FONT_STYLE: TextFontStyle = { family: "serif", weight: 400, style: "normal" };

interface TextFontStyle {
  family: string;
  weight: number;
  style: string;
}

/** A text the tree draws and the characters none of its candidate fonts maps, unique and in order; a text drawn twice is listed once. */
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

function inheritFontStyle(node: OgNode, parent: TextFontStyle): TextFontStyle {
  const style = node.props.style ?? {};
  return {
    family: typeof style.fontFamily === "string" ? style.fontFamily : parent.family,
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

/** The character maps of the fonts Satori would try for a text, in its order. */
function getCandidateMaps(families: Map<string, SatoriFont[]>, font: TextFontStyle): OgResult<CharacterMap[]> {
  const requested = font.family.toLowerCase();
  const keys = [...(families.has(requested) ? [requested] : []), ...families.keys()];
  const maps: CharacterMap[] = [];
  for (const key of keys) {
    const selected = selectSatoriFont(families.get(key) ?? [], font);
    if (selected === undefined) continue;
    const map = loadCharacterMap(selected.data);
    if (!map.ok) return err(`the font "${selected.name}" ${selected.weight} ${selected.style}: ${map.error}`);
    maps.push(map.value);
  }
  return ok(maps);
}

/** Texts of the tree with characters none of the fonts Satori would try can draw. */
export function findMissingGlyphs(tree: OgNode, fonts: readonly SatoriFont[]): OgResult<MissingGlyphs[]> {
  const families = groupByFamily(fonts);
  const missing: MissingGlyphs[] = [];
  for (const { text, font } of listTexts(tree, DEFAULT_FONT_STYLE)) {
    const maps = getCandidateMaps(families, font);
    if (!maps.ok) return maps;
    const characters = new Set<string>();
    for (const character of text) {
      if (INVISIBLE_PATTERN.test(character)) continue;
      const codePoint = character.codePointAt(0) ?? 0;
      if (!maps.value.some((map) => map.has(codePoint))) characters.add(character);
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
