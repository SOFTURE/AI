import { CAPTION_LINE_HEIGHT, CAPTION_PILL_PADDING, type CaptionLayout } from "../compose/timeline.js";
import type { TimedWord } from "../voice/voiceover.js";
import { applySegmentCaption, CAPTION_SAFE_ZONES } from "./captions.js";
import { getEdlDuration, getSegmentStarts, findSegmentAt, type Edl } from "./edl.js";
import { getFootageEdit, type FootageFilm } from "./film.js";
import { FOOTAGE_FPS } from "./normalize.js";
import type { EdlOverlay, OverlaySide, OverlaySize } from "./overlay-schema.js";
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
/** A text overlay's type size in px of a 1080 px wide frame, by kind and size step. */
export const OVERLAY_FONT_SIZES: Record<"keyword" | "lower_third" | "list", Record<OverlaySize, number>> = {
  keyword: { s: 64, m: 84, l: 108 },
  lower_third: { s: 44, m: 52, l: 60 },
  list: { s: 40, m: 48, l: 56 },
};
/** A text overlay's line height and its box's padding, in font sizes. */
export const OVERLAY_LINE_HEIGHT = 1.15;
export const OVERLAY_LIST_LINE_HEIGHT = 1.4;
export const OVERLAY_PADDING_EM = { x: 0.6, y: 0.35 } as const;
/** The room kept between an overlay and the safe zone's edge or the captions, in px. */
export const OVERLAY_MARGIN = 24;
/** How far an arrow's tail sits from the point it points at, in px. */
const ARROW_REACH = { x: 220, y: 180 } as const;
/** The smallest highlight rectangle, in px. */
const MIN_HIGHLIGHT_SIDE = 40;
/** The safe zone of a frame that is not a 1080×1920 vertical: 80 px on every side. */
const DEFAULT_SAFE_MARGIN = 80;

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
  /** The segment it plays in. */
  segment: number;
}

/** A text overlay's box: `left` and `top` of its outer edge, its width the most it may take (it shrinks to its text). */
export type ResolvedOverlay =
  | (OverlayBase & { kind: "punch_in"; scale: number; ease: number })
  | (OverlayBase & { kind: "keyword" | "lower_third"; text: string; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (OverlayBase & { kind: "list"; items: string[]; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (OverlayBase & { kind: "arrow"; from: OverlayPoint; to: OverlayPoint })
  | (OverlayBase & { kind: "highlight"; rect: OverlayBox });

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

/**
 * The overlays of an EDL resolved to film time and placed, or every reason one cannot be drawn: its word is not said,
 * it is too short or runs past the cut or into the next segment, two overlap, two start closer than
 * `overlayMinSpacing`, a text overlay does not fit between the safe zone and the captions, an anchor leaves the safe
 * zone or sits on the captions, or a `punch_in` falls on a `kenburns` segment or inside a zoom cut's ease. An EDL
 * without overlays resolves to none.
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
    if (end > segmentEnd + 0.01) {
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
  const spacing = film.overlayMinSpacing ?? 0;
  ordered.forEach((overlay, place) => {
    const previous = ordered[place - 1];
    if (previous === undefined) return;
    if (overlay.start < previous.end - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts at ${overlay.start} s while overlays[${previous.index}] is on screen (until ${previous.end} s); one overlay at a time`);
    } else if (overlay.start - previous.start < spacing - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts ${r1(overlay.start - previous.start)} s after overlays[${previous.index}]; the film keeps overlays ${spacing} s apart (overlayMinSpacing)`);
    }
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, overlays: ordered };
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

function placeOverlay(overlay: EdlOverlay, base: OverlayBase, place: Placement): Placed {
  const size = overlay.style?.size ?? "m";
  if (overlay.kind === "punch_in") {
    const ease = r3(Math.min(PUNCH_IN_EASE_SECONDS, (base.end - base.start) / 2));
    return { ok: true, overlay: { ...base, kind: "punch_in", scale: PUNCH_IN_SCALES[size], ease } };
  }
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  if (overlay.kind === "arrow" || overlay.kind === "highlight") {
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
      return { ok: true, overlay: { ...base, kind: "arrow", from, to } };
    }
    const rect = { left: anchor.x, top: anchor.y, width: anchor.width ?? 0, height: anchor.height ?? 0 };
    if (rect.width < MIN_HIGHLIGHT_SIDE || rect.height < MIN_HIGHLIGHT_SIDE) return { ok: false, error: `the highlight is smaller than ${MIN_HIGHLIGHT_SIDE}×${MIN_HIGHLIGHT_SIDE} px` };
    const corner = { x: rect.left + rect.width, y: rect.top + rect.height };
    if (!isInsideZone(place, { x: rect.left, y: rect.top }) || !isInsideZone(place, corner)) return { ok: false, error: "the highlight reaches outside the platform safe zone" };
    if (isOnCaptions(place, rect.top, corner.y)) return { ok: false, error: "the highlight overlaps the captions" };
    return { ok: true, overlay: { ...base, kind: "highlight", rect } };
  }
  const side = overlay.style?.side ?? (overlay.kind === "keyword" ? "right" : "left");
  const fontSize = Math.round(OVERLAY_FONT_SIZES[overlay.kind][size] * scale);
  const padY = Math.round(fontSize * OVERLAY_PADDING_EM.y);
  const lines = overlay.kind === "list" ? (overlay.items ?? []).length : 1;
  const lineHeight = overlay.kind === "list" ? OVERLAY_LIST_LINE_HEIGHT : OVERLAY_LINE_HEIGHT;
  const height = Math.ceil(lines * fontSize * lineHeight + 2 * padY);
  const region = getTextRegion(place);
  const regionHeight = region.bottom - region.top;
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const top =
    overlay.kind === "lower_third"
      ? region.bottom - height
      : overlay.kind === "keyword"
        ? Math.round(region.top + regionHeight * 0.4 - height / 2)
        : Math.round(region.top + regionHeight * 0.15);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the ${overlay.kind.replace("_", " ")} (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or fewer points` };
  }
  const box = { left: zone.left + margin, top, width: frame.width - zone.left - zone.right - 2 * margin, height };
  if (overlay.kind === "list") return { ok: true, overlay: { ...base, kind: "list", items: overlay.items ?? [], fontSize, side, box } };
  return { ok: true, overlay: { ...base, kind: overlay.kind, text: overlay.text ?? "", fontSize, side, box } };
}

/** The texts the overlays draw, for the glyph check. */
export function getOverlayTexts(overlays: readonly ResolvedOverlay[]): string[] {
  return overlays.flatMap((overlay) => (overlay.kind === "keyword" || overlay.kind === "lower_third" ? [overlay.text] : overlay.kind === "list" ? overlay.items : []));
}
