import { CAPTION_LINE_HEIGHT, CAPTION_PILL_PADDING, type CaptionLayout } from "../compose/timeline.js";
import type { TimedWord } from "../voice/voiceover.js";
import { applySegmentCaption, CAPTION_SAFE_ZONES } from "./captions.js";
import { getEdlDuration, getSegmentStarts, findSegmentAt, type Edl } from "./edl.js";
import { getFootageEdit, type FootageFilm } from "./film.js";
import { FOOTAGE_FPS } from "./normalize.js";
import {
  DEFAULT_OVERLAY_TYPING_SPEED,
  isTypedOverlay,
  type EdlOverlay,
  type EdlOverlayColors,
  type OverlayEntrance,
  type OverlayKind,
  type OverlayPosition,
  type OverlaySide,
  type OverlaySize,
} from "./overlay-schema.js";
import { getSegmentZoomEases } from "./compose.js";
import { normalizeWord } from "./words.js";

/**
 * An EDL's overlays resolved for the render and the draft (issue #1200): each one's film time (from its word through
 * the cut, or its second), the segment it plays in, and where it sits in the frame, inside the platform safe zone and
 * clear of the captions. `resolveEdlOverlays` refuses, with a reason per overlay, anything the render could not draw
 * cleanly; the app's own budget (how many, how often) goes on top through `overlayMinSpacing`.
 */

/** How far a `punch_in` zooms the picture, by size step (100 % to this, then back). */
export const PUNCH_IN_SCALES: Record<OverlaySize, number> = { s: 1.08, m: 1.12, l: 1.15 };
/** The `punch_in`'s ease into its zoom and back out, in seconds (shorter when the overlay is short). */
export const PUNCH_IN_EASE_SECONDS = 0.35;

/** The kinds drawn with text: every kind but `punch_in`, `arrow` and `highlight`. */
export type TextOverlayKind = Exclude<OverlayKind, "punch_in" | "arrow" | "highlight">;

/** A text overlay's main type size in px of a 1080 px wide frame, by kind and size step. */
export const OVERLAY_FONT_SIZES: Record<TextOverlayKind, Record<OverlaySize, number>> = {
  keyword: { s: 64, m: 84, l: 108 },
  lower_third: { s: 44, m: 52, l: 60 },
  list: { s: 40, m: 48, l: 56 },
  hook_title: { s: 52, m: 64, l: 76 },
  search_bar: { s: 36, m: 42, l: 50 },
  place_card: { s: 72, m: 92, l: 112 },
  counter: { s: 84, m: 108, l: 132 },
  date_stamp: { s: 30, m: 36, l: 44 },
};
/** A second line's type size in main font sizes: the hook title's place label, the subtitle, the unit, the stamp's place. */
export const OVERLAY_SECONDARY_SCALE = { hook_title: 0.55, place_card: 0.42, counter: 0.5, date_stamp: 0.78 } as const;
/** A text overlay's line height and its box's padding, in font sizes. */
export const OVERLAY_LINE_HEIGHT = 1.15;
export const OVERLAY_LIST_LINE_HEIGHT = 1.4;
/** A place card title's line height, tighter for its big type. */
export const OVERLAY_TITLE_LINE_HEIGHT = 1.05;
export const OVERLAY_PADDING_EM = { x: 0.6, y: 0.35 } as const;
/** The search field's padding round its query, in font sizes (its height is the line plus twice this). */
export const SEARCH_BAR_PADDING_EM = { x: 0.7, y: 0.55 } as const;
/** The room the search field's magnifier and its gap take before the query, in font sizes. */
export const SEARCH_BAR_ICON_EM = 1.5;
/** The average advance of a bold Latin letter, in font sizes: how wide a line is estimated before it is drawn. */
export const OVERLAY_CHAR_EM = 0.56;
/** The most lines a hook title or a place card's title wraps to. */
export const MAX_OVERLAY_TITLE_LINES = 2;
/** The room kept between an overlay and the safe zone's edge or the captions, in px. */
export const OVERLAY_MARGIN = 24;
/** How far an arrow's tail sits from the point it points at, in px. */
const ARROW_REACH = { x: 220, y: 180 } as const;
/** The smallest highlight rectangle, in px. */
const MIN_HIGHLIGHT_SIDE = 40;
/** The safe zone of a frame that is not a 1080×1920 vertical: 80 px on every side. */
const DEFAULT_SAFE_MARGIN = 80;

/** The brand font a text overlay is drawn in: `heading` for titles and numbers, `interface` for labels and lists. */
export type OverlayFontRole = "heading" | "interface";

/** Each text kind's font role (the hook title's place label and a place card's subtitle are interface text). */
export const OVERLAY_FONT_ROLES: Record<TextOverlayKind, OverlayFontRole> = {
  keyword: "heading",
  hook_title: "heading",
  place_card: "heading",
  counter: "heading",
  lower_third: "interface",
  list: "interface",
  search_bar: "interface",
  date_stamp: "interface",
};

/** A box in the film's frame, in px. */
export interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayPoint {
  x: number;
  y: number;
}

interface OverlayBase {
  /** The overlay's place in `edl.overlays`. */
  index: number;
  /** Film seconds. */
  start: number;
  end: number;
  /** The segment it starts in. */
  segment: number;
}

/** How a drawn overlay looks besides its place: its entrance (null: the kind's own), typing speed and own colours. */
export interface OverlayLook {
  entrance: OverlayEntrance | null;
  /** Characters per second when it types its text in, else null. */
  typing: number | null;
  /** Its own colours in place of the brand's (empty: the brand's). */
  colors: EdlOverlayColors;
}

type Drawn = OverlayBase & OverlayLook;

/**
 * A text overlay's box: for `keyword`, `lower_third` and `list`, `left` and `top` of its outer edge and the most it
 * may take (it shrinks to its text); for the others, the box its card takes.
 */
export type ResolvedOverlay =
  | (OverlayBase & { kind: "punch_in"; scale: number; ease: number })
  | (Drawn & { kind: "keyword"; text: string; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (Drawn & { kind: "lower_third"; text: string; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (Drawn & { kind: "list"; items: string[]; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (Drawn & { kind: "arrow"; from: OverlayPoint; to: OverlayPoint })
  | (Drawn & { kind: "highlight"; rect: OverlayBox })
  | (Drawn & { kind: "hook_title"; lines: string[]; place: string | null; fontSize: number; placeFontSize: number; box: OverlayBox })
  | (Drawn & { kind: "search_bar"; text: string; fontSize: number; box: OverlayBox })
  | (Drawn & { kind: "place_card"; lines: string[]; subtitle: string | null; fontSize: number; subtitleFontSize: number; box: OverlayBox })
  | (Drawn & { kind: "counter"; value: number; from: number; decimals: number; unit: string | null; fontSize: number; unitFontSize: number; box: OverlayBox })
  | (Drawn & { kind: "date_stamp"; text: string; place: string | null; fontSize: number; placeFontSize: number; side: OverlaySide; box: OverlayBox });

export type ResolvedOverlaysResult = { ok: true; overlays: ResolvedOverlay[] } | { ok: false; problems: string[] };

export interface ResolveOverlaysInput {
  film: Pick<FootageFilm, "captions" | "captionMaxLines" | "format" | "captionPreset" | "edit" | "overlayMinSpacing">;
  edl: Edl;
  /** The film's words in film time (`remapWords`). */
  words: TimedWord[];
  frame: { width: number; height: number };
  /** The film's caption box (`getFootageCaptionLayout`). */
  caption: CaptionLayout;
}

/** The part of the frame no platform interface covers: a 9:16 film's caption preset zone (`all` without one), else 80 px. */
export function getOverlaySafeZone(film: Pick<FootageFilm, "format" | "captionPreset">, frame: { width: number; height: number }): { top: number; bottom: number; left: number; right: number } {
  if (film.format === "9:16" && frame.width === 1080 && frame.height === 1920) return CAPTION_SAFE_ZONES[film.captionPreset ?? "all"];
  return { top: DEFAULT_SAFE_MARGIN, bottom: DEFAULT_SAFE_MARGIN, left: DEFAULT_SAFE_MARGIN, right: DEFAULT_SAFE_MARGIN };
}

/** The rows a caption card can take in a segment (its box moved by the segment's `caption`), or null without captions. */
function getCaptionBand(input: ResolveOverlaysInput, segment: number): { top: number; bottom: number } | null {
  if (!input.film.captions) return null;
  const place = applySegmentCaption(input.caption, input.edl.segments[segment]?.caption);
  const lines = input.film.captionMaxLines ?? 2;
  const height = Math.ceil(lines * place.fontSize * CAPTION_LINE_HEIGHT + 2 * CAPTION_PILL_PADDING.y);
  if (place.bottom !== undefined) return { top: input.frame.height - place.bottom - height, bottom: input.frame.height - place.bottom };
  return { top: place.top, bottom: place.top + height };
}

/** The film second an overlay starts at, or the reason its word cannot be found. */
function findOverlayStart(overlay: EdlOverlay, words: TimedWord[]): { ok: true; start: number } | { ok: false; error: string } {
  if (overlay.at !== undefined) return { ok: true, start: overlay.at };
  const wanted = overlay.at_word as NonNullable<EdlOverlay["at_word"]>;
  const key = normalizeWord(wanted.text);
  const occurrence = wanted.occurrence ?? 1;
  const matches = words.filter((word) => normalizeWord(word.text) === key);
  const word = matches[occurrence - 1];
  if (word === undefined) {
    const said = matches.length === 0 ? "the film never says it" : `the film says it ${matches.length} time${matches.length === 1 ? "" : "s"}`;
    return { ok: false, error: `at_word: no word "${wanted.text}"${occurrence > 1 ? ` (occurrence ${occurrence})` : ""} in the cut; ${said}` };
  }
  return { ok: true, start: word.start };
}

const r1 = (value: number): number => Math.round(value * 10) / 10;
const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The estimated width of a line of text at a font size, in px (`OVERLAY_CHAR_EM` a letter). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil([...text].length * OVERLAY_CHAR_EM * fontSize - 1e-6);
}

/** Text broken into lines at spaces so each fits `width` at `fontSize` by the estimate; a word longer than a line stands alone. */
export function wrapOverlayText(text: string, fontSize: number, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter((part) => part.length > 0)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && estimateTextWidth(`${last} ${word}`, fontSize) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** The decimals a number is written with: 0, 1 or 2. */
function countDecimals(number: number): number {
  if (Number.isInteger(number)) return 0;
  return Number.isInteger(Math.round(number * 100) / 10) ? 1 : 2;
}

/** The number of decimals a counter shows: the most of its value's and its start's (at most two). */
export function getCounterDecimals(value: number, from: number): number {
  return Math.max(countDecimals(value), countDecimals(from));
}

/** A counter's number as the film shows it, grouped as `locale` writes numbers, with plain spaces for the group gaps. */
export function formatOverlayNumber(value: number, decimals: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value).replace(/[\u00a0\u202f]/g, " ");
}

/** Whether two boxes share any px. */
function isOverlapping(a: OverlayBox, b: OverlayBox): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/** The box a drawn overlay takes in the frame, or null for a `punch_in` (it draws nothing). */
export function getOverlayBounds(overlay: ResolvedOverlay): OverlayBox | null {
  if (overlay.kind === "punch_in") return null;
  if (overlay.kind === "highlight") return overlay.rect;
  if (overlay.kind === "arrow") {
    const [left, top] = [Math.min(overlay.from.x, overlay.to.x), Math.min(overlay.from.y, overlay.to.y)];
    return { left, top, width: Math.max(overlay.from.x, overlay.to.x) - left, height: Math.max(overlay.from.y, overlay.to.y) - top };
  }
  return overlay.box;
}

/**
 * The overlays of an EDL resolved to film time and placed, or every reason one cannot be drawn: its word is not said,
 * it is too short or runs past the cut or into the next segment (a `hook_title` may stay across cuts), two overlap,
 * two start closer than `overlayMinSpacing`, a text overlay does not fit between the safe zone and the captions, an
 * anchor leaves the safe zone or sits on the captions, or a `punch_in` falls on a `kenburns` segment or inside a zoom
 * cut's ease. A `hook_title` lives in the top band: it does not count against one overlay at a time or the spacing,
 * but nothing drawn while it shows may sit on it. An EDL without overlays resolves to none.
 */
export function resolveEdlOverlays(input: ResolveOverlaysInput): ResolvedOverlaysResult {
  const overlays = input.edl.overlays ?? [];
  if (overlays.length === 0) return { ok: true, overlays: [] };
  const { frame, film, edl } = input;
  const cutEnd = getEdlDuration(edl);
  const starts = getSegmentStarts(edl);
  const eases = getSegmentZoomEases(edl, getFootageEdit(film));
  const zone = getOverlaySafeZone(film, frame);
  const problems: string[] = [];
  const resolved: ResolvedOverlay[] = [];
  overlays.forEach((overlay, index) => {
    const at = `overlays[${index}]`;
    const found = findOverlayStart(overlay, input.words);
    if (!found.ok) {
      problems.push(`${at}.${found.error}`);
      return;
    }
    const start = r3(found.start);
    const end = r3(start + overlay.duration);
    if (end > cutEnd + 0.001) {
      problems.push(`${at}: ends at ${end} s, past the cut's end (${cutEnd} s)`);
      return;
    }
    const segment = findSegmentAt(edl, start);
    const segmentStart = starts[segment] as number;
    const segmentEnd = r3(segmentStart + ((edl.segments[segment]?.end ?? 0) - (edl.segments[segment]?.start ?? 0)));
    const segmentId = edl.segments[segment]?.id ?? "";
    if (overlay.kind !== "hook_title" && end > segmentEnd + 0.01) {
      problems.push(`${at}: runs ${r1(end - segmentEnd)} s past the cut at ${segmentEnd} s; keep it inside segment "${segmentId}" (${segmentStart}-${segmentEnd} s) or shorten it`);
      return;
    }
    const base = { index, start, end, segment };
    const placed = placeOverlay(overlay, base, { zone, frame, band: getCaptionBand(input, segment) });
    if (!placed.ok) {
      problems.push(`${at}: ${placed.error}`);
      return;
    }
    if (placed.overlay.kind === "punch_in") {
      if (edl.segments[segment]?.motion === "kenburns") {
        problems.push(`${at}: segment "${segmentId}" has a Ken Burns zoom, which owns the picture's scale; put the punch-in on a still segment`);
        return;
      }
      const easeEnd = r3(segmentStart + (eases[segment] ?? 0) / FOOTAGE_FPS);
      if (start < easeEnd) {
        problems.push(`${at}: starts at ${start} s, inside the zoom cut's ease of segment "${segmentId}" (until ${easeEnd} s); start it later`);
        return;
      }
    }
    resolved.push(placed.overlay);
  });
  const ordered = [...resolved].sort((a, b) => a.start - b.start);
  problems.push(...findTimingProblems(ordered, film.overlayMinSpacing ?? 0));
  return problems.length > 0 ? { ok: false, problems } : { ok: true, overlays: ordered };
}

/** Whether two overlays are on screen at the same time. */
function isConcurrent(a: ResolvedOverlay, b: ResolvedOverlay): boolean {
  return a.start < b.end - 0.001 && b.start < a.end - 0.001;
}

/** Two overlays on screen at once, two too close, two hook titles at once, or a drawing on a hook title while it shows. */
function findTimingProblems(ordered: readonly ResolvedOverlay[], spacing: number): string[] {
  const problems: string[] = [];
  const counted = ordered.filter((overlay) => overlay.kind !== "hook_title");
  counted.forEach((overlay, place) => {
    const previous = counted[place - 1];
    if (previous === undefined) return;
    if (overlay.start < previous.end - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts at ${overlay.start} s while overlays[${previous.index}] is on screen (until ${previous.end} s); one overlay at a time`);
    } else if (overlay.start - previous.start < spacing - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts ${r1(overlay.start - previous.start)} s after overlays[${previous.index}]; the film keeps overlays ${spacing} s apart (overlayMinSpacing)`);
    }
  });
  const titles = ordered.filter((overlay) => overlay.kind === "hook_title");
  titles.forEach((title, place) => {
    const previous = titles[place - 1];
    if (previous !== undefined && isConcurrent(title, previous)) {
      problems.push(`overlays[${title.index}]: starts at ${title.start} s while the hook title overlays[${previous.index}] is on screen (until ${previous.end} s); one hook title at a time`);
    }
    const titleBox = title.box;
    for (const other of counted) {
      const bounds = getOverlayBounds(other);
      if (bounds === null || !isConcurrent(title, other) || !isOverlapping(bounds, titleBox)) continue;
      problems.push(`overlays[${other.index}]: the ${other.kind.replace("_", " ")} would sit on the hook title overlays[${title.index}] (on screen until ${title.end} s); move it lower or start it after the title`);
    }
  });
  return problems;
}

interface Placement {
  zone: { top: number; bottom: number; left: number; right: number };
  frame: { width: number; height: number };
  band: { top: number; bottom: number } | null;
}

type Placed = { ok: true; overlay: ResolvedOverlay } | { ok: false; error: string };

/** The rows a text overlay may use: the safe zone's height above the captions (or below them when they sit high). */
function getTextRegion(place: Placement): { top: number; bottom: number } {
  const top = place.zone.top;
  const bottom = place.frame.height - place.zone.bottom;
  if (place.band === null) return { top, bottom };
  const isLow = (place.band.top + place.band.bottom) / 2 > place.frame.height / 2;
  return isLow ? { top, bottom: Math.min(bottom, place.band.top - OVERLAY_MARGIN) } : { top: Math.max(top, place.band.bottom + OVERLAY_MARGIN), bottom };
}

/** Whether a row range overlaps the caption band. */
function isOnCaptions(place: Placement, top: number, bottom: number): boolean {
  return place.band !== null && top < place.band.bottom && bottom > place.band.top;
}

function isInsideZone(place: Placement, point: OverlayPoint): boolean {
  const { zone, frame } = place;
  return point.x >= zone.left && point.x <= frame.width - zone.right && point.y >= zone.top && point.y <= frame.height - zone.bottom;
}

/** The top of a box `height` tall at a named position of the text region. */
function getPositionTop(region: { top: number; bottom: number }, position: OverlayPosition, height: number): number {
  if (position === "top") return region.top;
  if (position === "bottom") return region.bottom - height;
  return Math.round(region.top + (region.bottom - region.top) * 0.4 - height / 2);
}

function getLook(overlay: EdlOverlay): OverlayLook {
  return {
    entrance: overlay.style?.entrance ?? null,
    typing: isTypedOverlay(overlay) ? (overlay.style?.typing_speed ?? DEFAULT_OVERLAY_TYPING_SPEED) : null,
    colors: { ...overlay.style?.colors },
  };
}

function placeOverlay(overlay: EdlOverlay, base: OverlayBase, place: Placement): Placed {
  if (overlay.kind === "punch_in") {
    const ease = r3(Math.min(PUNCH_IN_EASE_SECONDS, (base.end - base.start) / 2));
    return { ok: true, overlay: { ...base, kind: "punch_in", scale: PUNCH_IN_SCALES[overlay.style?.size ?? "m"], ease } };
  }
  const drawn = { ...base, ...getLook(overlay) };
  if (overlay.kind === "arrow" || overlay.kind === "highlight") return placeMark(overlay, drawn, place);
  if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "list") return placeSideText({ ...overlay, kind: overlay.kind }, drawn, place);
  return placeCard({ ...overlay, kind: overlay.kind }, drawn, place);
}

/** An arrow's tail and point, or a highlight's rectangle. */
function placeMark(overlay: EdlOverlay, drawn: Drawn, place: Placement): Placed {
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  const anchor = overlay.anchor as NonNullable<EdlOverlay["anchor"]>;
  if (overlay.kind === "arrow") {
    const to = { x: anchor.x, y: anchor.y };
    if (!isInsideZone(place, to)) return { ok: false, error: `the arrow's point (${to.x}, ${to.y}) is outside the platform safe zone` };
    if (isOnCaptions(place, to.y, to.y)) return { ok: false, error: `the arrow's point (${to.x}, ${to.y}) sits on the captions` };
    const clampX = (x: number) => Math.min(frame.width - zone.right, Math.max(zone.left, x));
    const clampY = (y: number) => Math.min(frame.height - zone.bottom, Math.max(zone.top, y));
    const dx = Math.round(ARROW_REACH.x * scale);
    const dy = Math.round(ARROW_REACH.y * scale);
    // The tail sits towards the frame's middle and above the point (below it near the top), so the arrow reads inward.
    const from = { x: clampX(to.x > frame.width / 2 ? to.x - dx : to.x + dx), y: clampY(to.y - dy >= zone.top ? to.y - dy : to.y + dy) };
    if (isOnCaptions(place, Math.min(from.y, to.y), Math.max(from.y, to.y))) return { ok: false, error: "the arrow would cross the captions; point at something further from them" };
    return { ok: true, overlay: { ...drawn, kind: "arrow", from, to } };
  }
  const rect = { left: anchor.x, top: anchor.y, width: anchor.width ?? 0, height: anchor.height ?? 0 };
  if (rect.width < MIN_HIGHLIGHT_SIDE || rect.height < MIN_HIGHLIGHT_SIDE) return { ok: false, error: `the highlight is smaller than ${MIN_HIGHLIGHT_SIDE}×${MIN_HIGHLIGHT_SIDE} px` };
  const corner = { x: rect.left + rect.width, y: rect.top + rect.height };
  if (!isInsideZone(place, { x: rect.left, y: rect.top }) || !isInsideZone(place, corner)) return { ok: false, error: "the highlight reaches outside the platform safe zone" };
  if (isOnCaptions(place, rect.top, corner.y)) return { ok: false, error: "the highlight overlaps the captions" };
  return { ok: true, overlay: { ...drawn, kind: "highlight", rect } };
}

/** A keyword, a lower third or a list: a card on one side, its box the whole width it may take. */
function placeSideText(overlay: EdlOverlay & { kind: "keyword" | "lower_third" | "list" }, drawn: Drawn, place: Placement): Placed {
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  const side = overlay.style?.side ?? (overlay.kind === "keyword" ? "right" : "left");
  const fontSize = Math.round(OVERLAY_FONT_SIZES[overlay.kind][overlay.style?.size ?? "m"] * scale);
  const padY = Math.round(fontSize * OVERLAY_PADDING_EM.y);
  const lines = overlay.kind === "list" ? (overlay.items ?? []).length : 1;
  const lineHeight = overlay.kind === "list" ? OVERLAY_LIST_LINE_HEIGHT : OVERLAY_LINE_HEIGHT;
  const height = Math.ceil(lines * fontSize * lineHeight + 2 * padY);
  const region = getTextRegion(place);
  // Without a position, each kind's own place: the lower third on the captions' room, the keyword in the middle, the list high.
  const position = overlay.style?.position ?? (overlay.kind === "lower_third" ? "bottom" : overlay.kind === "keyword" ? "middle" : null);
  const top = position === null ? Math.round(region.top + (region.bottom - region.top) * 0.15) : getPositionTop(region, position, height);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the ${overlay.kind.replace("_", " ")} (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or fewer points` };
  }
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const box = { left: zone.left + margin, top, width: frame.width - zone.left - zone.right - 2 * margin, height };
  if (overlay.kind === "list") return { ok: true, overlay: { ...drawn, kind: "list", items: overlay.items ?? [], fontSize, side, box } };
  const fields = { text: overlay.text ?? "", fontSize, side, box };
  return { ok: true, overlay: overlay.kind === "keyword" ? { ...drawn, kind: "keyword", ...fields } : { ...drawn, kind: "lower_third", ...fields } };
}

type CardKind = "hook_title" | "search_bar" | "place_card" | "counter" | "date_stamp";

/** The default position of each card. */
const CARD_POSITIONS: Record<CardKind, OverlayPosition> = { hook_title: "top", search_bar: "middle", place_card: "middle", counter: "middle", date_stamp: "top" };

interface CardContent {
  /** The card's content box without its padding, in px. */
  width: number;
  height: number;
  /** The overlay's own fields. */
  fields: Record<string, unknown>;
}

type CardResult = { ok: true; content: CardContent } | { ok: false; error: string };

interface CardMetrics {
  fontSize: number;
  pad: { x: number; y: number };
  /** The widest the content may be, in px. */
  room: number;
  label: string;
}

const tooWide = (metrics: CardMetrics, what: string): CardResult => ({ ok: false, error: `the ${metrics.label}'s ${what} is too wide for one line; shorten it or use a smaller size` });

/** A hook title's or a place card's lines and second line. */
function measureTitle(overlay: EdlOverlay & { kind: "hook_title" | "place_card" }, metrics: CardMetrics): CardResult {
  const { fontSize, room, label } = metrics;
  const lines = wrapOverlayText(overlay.text ?? "", fontSize, room);
  if (lines.length > MAX_OVERLAY_TITLE_LINES || lines.some((line) => estimateTextWidth(line, fontSize) > room)) {
    return { ok: false, error: `the ${label} takes more than ${MAX_OVERLAY_TITLE_LINES} lines; shorten it or use a smaller size` };
  }
  const isHook = overlay.kind === "hook_title";
  const second = (isHook ? overlay.place : overlay.subtitle) ?? null;
  const secondSize = Math.round(fontSize * OVERLAY_SECONDARY_SCALE[overlay.kind]);
  // The hook title's place label carries a pin about one label line wide before it.
  const secondWidth = second === null ? 0 : estimateTextWidth(second, secondSize) + (isHook ? Math.round(secondSize * 1.1) : 0);
  if (secondWidth > room) return tooWide(metrics, isHook ? "place label" : "subtitle");
  const lineHeight = isHook ? OVERLAY_LINE_HEIGHT : OVERLAY_TITLE_LINE_HEIGHT;
  return {
    ok: true,
    content: {
      width: Math.max(secondWidth, ...lines.map((line) => estimateTextWidth(line, fontSize))),
      height: lines.length * fontSize * lineHeight + (second === null ? 0 : secondSize * 1.3 + fontSize * 0.12),
      fields: isHook ? { kind: "hook_title", lines, place: second, fontSize, placeFontSize: secondSize } : { kind: "place_card", lines, subtitle: second, fontSize, subtitleFontSize: secondSize },
    },
  };
}

/** A search field: wide whatever its query (a search field, not a pill round a word), its query on one line. */
function measureSearchBar(overlay: EdlOverlay, metrics: CardMetrics): CardResult {
  const { fontSize, pad, room } = metrics;
  const text = overlay.text ?? "";
  const searchPad = { x: Math.round(fontSize * SEARCH_BAR_PADDING_EM.x), y: Math.round(fontSize * SEARCH_BAR_PADDING_EM.y) };
  const width = Math.round(fontSize * SEARCH_BAR_ICON_EM) + estimateTextWidth(text, fontSize) + 2 * searchPad.x;
  if (width > room + 2 * pad.x) return tooWide(metrics, "query");
  const fieldWidth = Math.max(Math.round((room + 2 * pad.x) * 0.82), width);
  const height = Math.ceil(fontSize * OVERLAY_LINE_HEIGHT + 2 * searchPad.y);
  return { ok: true, content: { width: fieldWidth - 2 * pad.x, height: height - 2 * pad.y, fields: { kind: "search_bar", text, fontSize } } };
}

/** A counter: its widest number (the final value, grouped as en-US groups, as widely as any locale) and its unit. */
function measureCounter(overlay: EdlOverlay, metrics: CardMetrics): CardResult {
  const { fontSize, room } = metrics;
  const value = overlay.value ?? 0;
  const from = overlay.from ?? 0;
  const decimals = getCounterDecimals(value, from);
  const unit = overlay.unit ?? null;
  const unitSize = Math.round(fontSize * OVERLAY_SECONDARY_SCALE.counter);
  const width = estimateTextWidth(formatOverlayNumber(value, decimals, "en-US"), fontSize) + (unit === null ? 0 : Math.round(unitSize * 0.3) + estimateTextWidth(unit, unitSize));
  if (width > room) return tooWide(metrics, "number");
  return { ok: true, content: { width, height: fontSize * 1.1, fields: { kind: "counter", value, from, decimals, unit, fontSize, unitFontSize: unitSize } } };
}

/** A date stamp: its day or date, and its place on a second line. */
function measureDateStamp(overlay: EdlOverlay, metrics: CardMetrics): CardResult {
  const { fontSize, room } = metrics;
  const text = overlay.text ?? "";
  const place = overlay.place ?? null;
  const placeSize = Math.round(fontSize * OVERLAY_SECONDARY_SCALE.date_stamp);
  const textWidth = estimateTextWidth(text, fontSize);
  const placeWidth = place === null ? 0 : estimateTextWidth(place, placeSize);
  if (textWidth > room) return tooWide(metrics, "text");
  if (placeWidth > room) return tooWide(metrics, "place");
  return {
    ok: true,
    content: {
      width: Math.max(textWidth, placeWidth),
      height: fontSize * OVERLAY_LINE_HEIGHT + (place === null ? 0 : placeSize * 1.25),
      fields: { kind: "date_stamp", text, place, fontSize, placeFontSize: placeSize, side: overlay.style?.side ?? "left" },
    },
  };
}

/** A hook title, a search bar, a place card, a counter or a date stamp: a card sized to its estimated content. */
function placeCard(overlay: EdlOverlay & { kind: CardKind }, drawn: Drawn, place: Placement): Placed {
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const outer = frame.width - zone.left - zone.right - 2 * margin;
  const fontSize = Math.round(OVERLAY_FONT_SIZES[overlay.kind][overlay.style?.size ?? "m"] * scale);
  const pad = { x: Math.round(fontSize * OVERLAY_PADDING_EM.x), y: Math.round(fontSize * OVERLAY_PADDING_EM.y) };
  const metrics = { fontSize, pad, room: outer - 2 * pad.x, label: overlay.kind.replace("_", " ") };
  const measured =
    overlay.kind === "hook_title" || overlay.kind === "place_card"
      ? measureTitle({ ...overlay, kind: overlay.kind }, metrics)
      : overlay.kind === "search_bar"
        ? measureSearchBar(overlay, metrics)
        : overlay.kind === "counter"
          ? measureCounter(overlay, metrics)
          : measureDateStamp(overlay, metrics);
  if (!measured.ok) return measured;
  const { content } = measured;
  const width = Math.ceil(content.width + 2 * pad.x);
  const height = Math.ceil(content.height + 2 * pad.y);
  const region = getTextRegion(place);
  const top = getPositionTop(region, overlay.style?.position ?? CARD_POSITIONS[overlay.kind], height);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the ${metrics.label} (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or shorter text` };
  }
  const left =
    overlay.kind !== "date_stamp" ? Math.round(zone.left + margin + (outer - width) / 2) : content.fields.side === "right" ? frame.width - zone.right - margin - width : zone.left + margin;
  return { ok: true, overlay: { ...drawn, ...content.fields, box: { left, top, width, height } } as ResolvedOverlay };
}

/** The texts the overlays draw, by the brand font that draws them, for the glyph check. */
export function getOverlayTextsByRole(overlays: readonly ResolvedOverlay[], locale = "en-US"): Record<OverlayFontRole, string[]> {
  const texts: Record<OverlayFontRole, string[]> = { heading: [], interface: [] };
  for (const overlay of overlays) {
    if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "search_bar") texts[OVERLAY_FONT_ROLES[overlay.kind]].push(overlay.text);
    else if (overlay.kind === "list") texts.interface.push(...overlay.items);
    else if (overlay.kind === "hook_title" || overlay.kind === "place_card") {
      texts.heading.push(...overlay.lines);
      const second = overlay.kind === "hook_title" ? overlay.place : overlay.subtitle;
      if (second !== null) texts.interface.push(second);
    } else if (overlay.kind === "counter") {
      // Every digit shows while it counts.
      texts.heading.push(formatOverlayNumber(overlay.value, overlay.decimals, locale), "0123456789", ...(overlay.unit === null ? [] : [overlay.unit]));
    } else if (overlay.kind === "date_stamp") {
      texts.interface.push(overlay.text, ...(overlay.place === null ? [] : [overlay.place]));
    }
  }
  return texts;
}

/** The texts the overlays draw, every role together. */
export function getOverlayTexts(overlays: readonly ResolvedOverlay[], locale = "en-US"): string[] {
  const texts = getOverlayTextsByRole(overlays, locale);
  return [...texts.heading, ...texts.interface];
}
