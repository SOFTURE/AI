import { readFileSync } from "node:fs";

import type { CaptionLayout } from "../compose/timeline.js";
import type { BrandFont } from "../config/config.js";
import { readCharacterMap, type CharacterMap } from "../og/character-map.js";
import type { TimedWord } from "../voice/voiceover.js";
import type { CaptionPreset } from "./film.js";

/**
 * The footage film's captions: plain phrases (the default style), the 9:16 caption box inside a platform's safe zone,
 * and a check that the caption and end-card fonts draw every letter the film shows (Polish letters above all), since
 * the browser would quietly draw a missing one in another font.
 */

export interface PhraseChunk {
  words: TimedWord[];
  start: number;
  end: number;
}

const MIN_PHRASE_WORDS = 2;
const MAX_PHRASE_WORDS = 6;
/** A silence this long between two words starts a new phrase. */
const PHRASE_GAP_SECONDS = 0.7;

/**
 * The words as phrases of 2-6: a phrase ends at punctuation, after six words or at a pause; a single word left alone
 * joins the phrase before it when that one has room and no pause separates them.
 */
export function phraseChunks(words: TimedWord[]): PhraseChunk[] {
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  words.forEach((word, index) => {
    const previous = words[index - 1];
    if (current.length > 0 && previous !== undefined && word.start - previous.end > PHRASE_GAP_SECONDS) {
      groups.push(current);
      current = [];
    }
    current.push(word);
    if (/[.,?!:;…]$/u.test(word.text) || current.length === MAX_PHRASE_WORDS) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length > 0) groups.push(current);
  const merged: TimedWord[][] = [];
  for (const group of groups) {
    const previous = merged.at(-1);
    const first = group[0] as TimedWord;
    const last = previous?.at(-1);
    const isClose = last !== undefined && first.start - last.end <= PHRASE_GAP_SECONDS;
    if (previous !== undefined && group.length < MIN_PHRASE_WORDS && previous.length < MAX_PHRASE_WORDS && isClose) previous.push(...group);
    else merged.push(group);
  }
  return merged.map((group) => ({ words: group, start: (group[0] as TimedWord).start, end: (group[group.length - 1] as TimedWord).end }));
}

/** Margins of a 1080×1920 frame that a platform's own buttons and text cover. */
export interface SafeZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The areas each platform keeps for its interface on a 9:16 video, rounded up from the platforms' creator guides; `all`
 * is the zone that is safe on every one of them.
 */
export const CAPTION_SAFE_ZONES: Record<CaptionPreset, SafeZone> = {
  reels: { top: 220, bottom: 420, left: 60, right: 120 },
  shorts: { top: 190, bottom: 380, left: 60, right: 140 },
  tiktok: { top: 160, bottom: 480, left: 60, right: 150 },
  all: { top: 220, bottom: 480, left: 60, right: 150 },
};

const FRAME_HEIGHT = 1920;
/** Two caption lines and the box's padding, in caption font sizes. */
const CAPTION_LINES_HEIGHT = 2.5;
const CAPTION_PADDING = 40;

/** The caption box of a 9:16 film with its bottom line kept above the preset's bottom margin, centred between equal sides. */
export function getCaptionPresetLayout(preset: CaptionPreset, fontSize: number): CaptionLayout {
  const zone = CAPTION_SAFE_ZONES[preset];
  const side = Math.max(zone.left, zone.right);
  const top = Math.round(FRAME_HEIGHT - zone.bottom - CAPTION_LINES_HEIGHT * fontSize - CAPTION_PADDING);
  return { top, left: side, right: side, fontSize };
}

/** A character a font is asked to draw and does not have. */
export interface MissingCaptionGlyphs {
  /** The family, as `brand.fonts` names it. */
  font: string;
  characters: string[];
}

const INVISIBLE_PATTERN = /^[\p{White_Space}\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}]$/u;

/** The character maps of a family's files; null when a file cannot be read (a WOFF2 file), so the family is not checked. */
function readFamilyMaps(font: BrandFont, read: (path: string) => Buffer): CharacterMap[] | null {
  const maps: CharacterMap[] = [];
  for (const file of font.files) {
    const map = readCharacterMap(read(file.path));
    if (!map.ok) return null;
    maps.push(map.value);
  }
  return maps;
}

/**
 * The characters of `texts` that no file of the family draws. A family whose files cannot all be read is skipped, and
 * so is text without a brand font (the system font draws it).
 */
function findMissingInFamily(font: BrandFont | null, texts: string[], read: (path: string) => Buffer): MissingCaptionGlyphs | null {
  if (font === null || font.files.length === 0) return null;
  const maps = readFamilyMaps(font, read);
  if (maps === null) return null;
  const characters = new Set<string>();
  for (const text of texts) {
    for (const character of text) {
      if (INVISIBLE_PATTERN.test(character)) continue;
      const codePoint = character.codePointAt(0) ?? 0;
      if (!maps.some((map) => map.has(codePoint))) characters.add(character);
    }
  }
  return characters.size === 0 ? null : { font: font.family, characters: [...characters] };
}

/**
 * Glyphs the film's fonts lack: the body font against the captions and the end card's url and note, the heading font
 * (the body font without one) against the brand name and the headline. Empty when every letter is drawn.
 */
export function findMissingCaptionGlyphs(
  input: { fonts: { heading: BrandFont | null; body: BrandFont | null }; captions: string[]; endCard: { headline: string; url: string; note: string } | null; brandName: string },
  read: (path: string) => Buffer = readFileSync,
): MissingCaptionGlyphs[] {
  const { fonts, endCard } = input;
  const body = findMissingInFamily(fonts.body, [...input.captions, ...(endCard === null ? [] : [endCard.url, endCard.note])], read);
  const headingTexts = endCard === null ? [] : [input.brandName, endCard.headline];
  const heading = findMissingInFamily(fonts.heading ?? fonts.body, headingTexts, read);
  const missing = [body, heading].filter((entry): entry is MissingCaptionGlyphs => entry !== null);
  // One family serving both roles is reported once.
  const merged = new Map<string, Set<string>>();
  for (const entry of missing) merged.set(entry.font, new Set([...(merged.get(entry.font) ?? []), ...entry.characters]));
  return [...merged].map(([font, characters]) => ({ font, characters: [...characters] }));
}
