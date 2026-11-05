import { readFileSync } from "node:fs";

import { CAPTION_LINE_HEIGHT, CAPTION_PILL_PADDING, resolveLayout, type CaptionLayout, type LayoutOverride } from "../compose/timeline.js";
import type { BrandFont } from "../config/config.js";
import { readCharacterMap, type CharacterMap } from "../og/character-map.js";
import type { TimedWord } from "../voice/voiceover.js";
import { findSegmentAt, type Edl, type EdlCaption, type EdlCaptionBounds } from "./edl.js";
import type { CaptionPreset, FootageFilm } from "./film.js";

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

/** When a caption chunk is on screen, in film seconds. */
export interface CaptionSpan {
  start: number;
  end: number;
}

const CAPTION_LEAD_SECONDS = 0.05;
const CAPTION_HOLD_SECONDS = 0.35;
const CAPTION_GAP_SECONDS = 0.06;
const MIN_CAPTION_SECONDS = 0.1;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/**
 * The span each caption chunk is shown for: from just before its first word to a moment after its last, never into
 * the next chunk, the last one never past the cut's end; at least 0.1 s. The render and the draft time captions alike.
 */
export function getCaptionSpans(chunks: readonly { start: number; end: number }[], cutEnd: number): CaptionSpan[] {
  return chunks.map((chunk, index) => {
    const next = chunks[index + 1];
    const start = r3(chunk.start - CAPTION_LEAD_SECONDS);
    const stop = Math.min(chunk.end + CAPTION_HOLD_SECONDS, next === undefined ? cutEnd : next.start - CAPTION_GAP_SECONDS);
    return { start, end: r3(start + r3(Math.max(MIN_CAPTION_SECONDS, stop - start))) };
  });
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

/**
 * The caption box of a 9:16 film anchored by its foot at the preset's bottom margin, so a card of any number of lines
 * grows upwards and never into the platform's interface; centred between equal sides. `top` is where a two-line box
 * would start, for readers of it.
 */
export function getCaptionPresetLayout(preset: CaptionPreset, fontSize: number): CaptionLayout {
  const zone = CAPTION_SAFE_ZONES[preset];
  const side = Math.max(zone.left, zone.right);
  const top = Math.round(FRAME_HEIGHT - zone.bottom - CAPTION_LINES_HEIGHT * fontSize - CAPTION_PADDING);
  return { top, bottom: zone.bottom, left: side, right: side, fontSize };
}

/**
 * The caption box a footage film's captions are drawn in: the format's layout, with a 9:16 film's box placed by its
 * caption preset unless the project overrides the caption box (`marketing.json` `layout`). The render and the draft
 * share it.
 */
export function getFootageCaptionLayout(film: Pick<FootageFilm, "format" | "captionPreset">, override: LayoutOverride = {}): CaptionLayout {
  const base = resolveLayout(film.format, override);
  if (film.captionPreset === undefined || film.format !== "9:16" || override.caption !== undefined) return base.caption;
  return getCaptionPresetLayout(film.captionPreset, base.caption.fontSize);
}

/**
 * A caption box moved by a segment's `caption` field: its `bottom` anchors the box by its foot; its `top` alone hangs
 * the box from that top (the film's `bottom` dropped). Without either, the film's box itself.
 */
export function applySegmentCaption(base: CaptionLayout, caption: EdlCaption | undefined): CaptionLayout {
  if (caption?.bottom !== undefined) return { ...base, top: caption.top ?? base.top, bottom: caption.bottom };
  if (caption?.top === undefined) return base;
  return { top: caption.top, left: base.left, right: base.right, fontSize: base.fontSize };
}

/** The caption box of one segment of the cut: the film's box (`getFootageCaptionLayout`) with the segment's `caption` over it. */
export function getSegmentCaptionLayout(film: Pick<FootageFilm, "format" | "captionPreset">, edl: Edl, segmentIndex: number, override: LayoutOverride = {}): CaptionLayout {
  return applySegmentCaption(getFootageCaptionLayout(film, override), edl.segments[segmentIndex]?.caption);
}

/**
 * The box each caption chunk is drawn in: the box of the segment where the chunk's first word starts (film time), so
 * a chunk that spans a cut keeps one box. The render and the draft place chunks alike.
 */
export function getCaptionChunkLayouts(chunks: readonly { start: number }[], edl: Edl, base: CaptionLayout): CaptionLayout[] {
  return chunks.map((chunk) => applySegmentCaption(base, edl.segments[findSegmentAt(edl, chunk.start)]?.caption));
}

/** Whether two caption boxes sit in the same place (a chunk in the film's box is drawn exactly as before). */
export function isSameCaptionPlace(a: CaptionLayout, b: CaptionLayout): boolean {
  return a.bottom === b.bottom && (a.bottom !== undefined || a.top === b.top);
}

/** The frame a segment's caption box must stay in (`validateEdl`): the frame's height and a one-line card's. */
export function getCaptionBounds(frameHeight: number, caption: Pick<CaptionLayout, "fontSize">): EdlCaptionBounds {
  return { frameHeight, cardHeight: Math.ceil(caption.fontSize * CAPTION_LINE_HEIGHT + 2 * CAPTION_PILL_PADDING.y) };
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
