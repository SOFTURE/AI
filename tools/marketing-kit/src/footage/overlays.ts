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
  type OverlayAlign,
  type OverlayEasing,
  type OverlayEntrance,
  type OverlayExit,
  type OverlayKind,
  type OverlayListLayout,
  type OverlayNoteStyle,
  type OverlayPosition,
  type OverlaySide,
  type OverlaySize,
} from "./overlay-schema.js";
import { isCameraMoving, isSameCamera } from "./camera.js";
import { getSegmentZoomEases } from "./compose.js";
import { normalizeWord } from "./words.js";
import { NOTE_FIRST_WORD_LEAD, NOTE_TICK_DELAY, getListItemStarts } from "./overlay-motion.js";
import { STYLE_PADDING_SCALES, type BrandStyle, type CornerRadius } from "./brand-style.js";
import { measureHandText } from "./hand-font.js";

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
  hook_title: { s: 50, m: 64, l: 82 },
  search_bar: { s: 36, m: 42, l: 50 },
  place_card: { s: 70, m: 92, l: 118 },
  counter: { s: 84, m: 108, l: 132 },
  date_stamp: { s: 30, m: 36, l: 44 },
  note: { s: 46, m: 56, l: 68 },
  end_word: { s: 120, m: 150, l: 180 },
};
/** A note strip's type size (its capitals), in px of a 1080 px wide frame; a note card's is `OVERLAY_FONT_SIZES.note`. */
export const NOTE_STRIP_FONT_SIZES: Record<OverlaySize, number> = { s: 38, m: 46, l: 54 };
/** A note's line height, and its padding round the text, in font sizes. */
export const NOTE_LINE_HEIGHT = 1.2;
export const NOTE_PADDING_EM = { x: 0.55, y: 0.4 } as const;
/** How deep a note's torn edge cuts into the paper, in font sizes (the card's foot, the strip's top). */
export const NOTE_TEAR_EM = 0.22;
/** The points along a note's torn edge. */
export const NOTE_TEAR_POINTS = 14;
/** A note's tick: its size and its gap after the last line, in font sizes. */
export const NOTE_TICK_EM = { size: 0.9, gap: 0.3 } as const;
/** The most words a line of a note card takes, and the most lines a note takes. */
export const MAX_NOTE_LINE_WORDS = 6;
export const MAX_NOTE_LINES = 4;
/** The share of the safe zone's width a note may take: a small card beside the subject, not a banner. */
export const NOTE_WIDTH_SHARE = 0.62;
/** A note's tilt in degrees, counter-clockwise positive as ASS turns (a note on the left leans back, on the right forward). */
export const NOTE_TILT = { card: 3, strip: 2 } as const;
/** A note's paper and ink without its own colours: an off-white paper and near-black ink, a green tick. */
export const NOTE_COLORS = { paper: "#fbf8f1", ink: "#1d1f24", tick: "#2f9e4f" } as const;
/** A second line's type size in main font sizes: the hook title's place label, the subtitle, the unit, the stamp's place. */
export const OVERLAY_SECONDARY_SCALE = { hook_title: 0.55, place_card: 0.55, counter: 0.5, date_stamp: 0.78 } as const;
/** A place card's subtitle size in title sizes, by its `subtitle_size` (RV-131 of an adopting app: 0.42 read tiny). */
export const OVERLAY_SUBTITLE_SCALES: Record<OverlaySize, number> = { s: 0.42, m: 0.55, l: 0.7 };
/** The smallest a place card's subtitle is drawn, in px of a 1080 px wide frame (2.3 % of a 1920 px tall one). */
export const MIN_OVERLAY_SUBTITLE_PX = 44;
/** How a title that does not fit two lines shrinks before it is refused: by this factor, at most `MAX_TITLE_SHRINKS` times. */
export const OVERLAY_TITLE_SHRINK = 0.9;
const MAX_TITLE_SHRINKS = 3;
/** A text overlay's line height and its box's padding, in font sizes. */
export const OVERLAY_LINE_HEIGHT = 1.15;
export const OVERLAY_LIST_LINE_HEIGHT = 1.4;
/** The room between two chips of a list's row, in font sizes. */
export const LIST_CHIP_GAP_EM = 0.3;
/** A chip's step badge before its point (a round accent mark with its number, a tick once the next point is in), in font sizes. */
export const LIST_CHIP_BADGE_EM = { size: 1.1, gap: 0.35 } as const;
/** How opaque a chip's point stays once the next point is in: it steps back, the newest point leads. */
export const LIST_CHIP_COVERED_OPACITY = 0.55;
/**
 * The smallest type a row of chips shrinks to, in px of a 1080 px wide frame: past a title's three shrinks a row keeps
 * shrinking down to it, so the step badges never turn a row that fitted without them into a refusal.
 */
export const LIST_CHIP_MIN_FONT_SIZE = 36;
/**
 * The smallest type a row of chips shrinks to so it can sit on the frame's axis (RV-185 of an adopting app), in px of a
 * 1080 px wide frame: in the centred span only, where a row that fits the whole zone at `LIST_CHIP_MIN_FONT_SIZE` would
 * otherwise stand off the axis.
 */
export const LIST_CHIP_CENTRED_MIN_FONT_SIZE = 32;
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
  // A note strip types in the heading font; a note card and an end word are handwritten (the kit's own `HAND_FONT`).
  note: "heading",
  end_word: "heading",
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
  /** Its card's own corner (`style.corner_radius`), else null: the brand style's, or the kind's own without one. */
  cornerRadius?: CornerRadius | null;
  /** Its card's padding in `OVERLAY_PADDING_EM`s: the brand style's `padding` (`STYLE_PADDING_SCALES`); absent: 1. */
  padScale?: number;
  /** How it leaves (`style.exit`); absent: `auto`, mirroring its entrance. */
  exit?: OverlayExit;
  /** The curve of its entrance and exit (`style.easing`); absent: `smooth`. */
  easing?: OverlayEasing;
}

type Drawn = OverlayBase & OverlayLook;

/**
 * A text overlay's box: for `keyword`, `lower_third` and `list`, `left` and `top` of its outer edge and the most it
 * may take (it shrinks to its text); for the others, the box its card takes.
 */
export type ResolvedOverlay =
  | (OverlayBase & { kind: "punch_in"; scale: number; ease: number })
  | (Drawn & {
      kind: "keyword";
      text: string;
      fontSize: number;
      side: OverlaySide;
      box: OverlayBox;
      underline?: boolean;
      /** Its card sits in the middle of `box`, its text centred (`style.align` center); absent: on its side. */
      isCentred?: boolean;
      /** Its text on a tight box (`style.backdrop` highlight); absent: the card. */
      backdrop?: "highlight";
    })
  | (Drawn & { kind: "lower_third"; text: string; fontSize: number; side: OverlaySide; box: OverlayBox })
  | (Drawn & {
      kind: "list";
      items: string[];
      fontSize: number;
      side: OverlaySide;
      box: OverlayBox;
      itemStarts?: number[];
      /** Its card sits in the middle of `box` with its lines centred (a stack without `style.side`); absent: on its side. */
      isCentred?: boolean;
      /** Each point's own card in one row (`style.list_layout` chips, or auto when they fit); absent: one stacked card. */
      chips?: OverlayBox[];
      /**
       * The x the chips shown so far centre on, the frame's axis (RV-185 of an adopting app), kept inside `box`; absent
       * (a list resolved before it): the full row's middle.
       */
      chipAxis?: number;
    })
  | (Drawn & { kind: "arrow"; from: OverlayPoint; to: OverlayPoint })
  | (Drawn & { kind: "highlight"; rect: OverlayBox })
  | (Drawn & {
      kind: "hook_title";
      lines: string[];
      place: string | null;
      fontSize: number;
      placeFontSize: number;
      align?: OverlayAlign;
      box: OverlayBox;
      /** Each line on its own tight box (`style.backdrop` highlight); absent: the card. */
      backdrop?: "highlight";
    })
  | (Drawn & { kind: "search_bar"; text: string; fontSize: number; box: OverlayBox })
  | (Drawn & {
      kind: "place_card";
      lines: string[];
      subtitle: string | null;
      fontSize: number;
      subtitleFontSize: number;
      align?: OverlayAlign;
      box: OverlayBox;
      /** Its accent pin above the title (`style.pin`); absent: none. */
      pin?: "static" | "drop";
      /** Seconds its subtitle waits after its title (`style.subtitle_delay`); absent: none. */
      subtitleDelay?: number;
      /**
       * Its subtitle's two balanced lines when one line does not fit the card's room at its smallest size, so the
       * card stays on the frame's axis (RV-184 of an adopting app); absent: one line, `subtitle`.
       */
      subtitleLines?: string[];
    })
  | (Drawn & { kind: "counter"; value: number; from: number; decimals: number; unit: string | null; fontSize: number; unitFontSize: number; box: OverlayBox })
  | (Drawn & { kind: "date_stamp"; text: string; place: string | null; fontSize: number; placeFontSize: number; side: OverlaySide; box: OverlayBox })
  | (Drawn & {
      kind: "note";
      noteStyle: OverlayNoteStyle;
      /** Its lines as drawn (a strip's in capitals). */
      lines: string[];
      fontSize: number;
      /** Its side, or `center` on the frame's axis (the default). */
      side: OverlaySide | "center";
      /** Its paper, unturned; it is drawn turned by `tilt` degrees about its middle. */
      box: OverlayBox;
      tilt: number;
      /** The torn edge's depth at each of `NOTE_TEAR_POINTS` points, 0 to 1 of `NOTE_TEAR_EM`. */
      tear: number[];
      /** The film second each word comes in at, in reading order (a card's words as they are said); null: a strip, typed. */
      wordTimes: number[] | null;
      /** Whether a hand tick is drawn after its last word (`style.tick`). */
      tick: boolean;
      /** The film second its tick starts being drawn; null without one. */
      tickAt: number | null;
    })
  | (Drawn & { kind: "end_word"; text: string; fontSize: number; box: OverlayBox });

export type ResolvedOverlaysResult = { ok: true; overlays: ResolvedOverlay[] } | { ok: false; problems: string[] };

export interface ResolveOverlaysInput {
  film: Pick<FootageFilm, "captions" | "captionMaxLines" | "format" | "captionPreset" | "edit" | "overlayMinSpacing">;
  edl: Edl;
  /** The film's words in film time (`remapWords`). */
  words: TimedWord[];
  frame: { width: number; height: number };
  /** The film's caption box (`getFootageCaptionLayout`). */
  caption: CaptionLayout;
  /** The brand's style: its `padding` pads every overlay card (absent: `m`, the cards' own padding). */
  style?: Pick<BrandStyle, "padding">;
}

/** The part of the frame no platform interface covers: a 9:16 film's caption preset zone (`all` without one), else 80 px. */
export function getOverlaySafeZone(film: Pick<FootageFilm, "format" | "captionPreset">, frame: { width: number; height: number }): { top: number; bottom: number; left: number; right: number } {
  if (film.format === "9:16" && frame.width === 1080 && frame.height === 1920) return CAPTION_SAFE_ZONES[film.captionPreset ?? "all"];
  return { top: DEFAULT_SAFE_MARGIN, bottom: DEFAULT_SAFE_MARGIN, left: DEFAULT_SAFE_MARGIN, right: DEFAULT_SAFE_MARGIN };
}

/**
 * The rows a caption card can take while an overlay shows, or null without captions: the box of the segment it starts
 * in (moved by the segment's `caption`) and of every caption range on screen with it (`Edl.captionRanges`), as one band.
 */
function getCaptionBand(input: ResolveOverlaysInput, at: { segment: number; start: number; end: number }): { top: number; bottom: number } | null {
  if (!input.film.captions) return null;
  const lines = input.film.captionMaxLines ?? 2;
  const ranges = (input.edl.captionRanges ?? []).filter((range) => range.from < at.end && at.start < range.to);
  const isWithinOneRange = ranges.some((range) => range.from <= at.start && at.end <= range.to);
  const places = [
    ...(isWithinOneRange ? [] : [applySegmentCaption(input.caption, input.edl.segments[at.segment]?.caption)]),
    ...ranges.map((range) => applySegmentCaption(input.caption, { ...(range.bottom === undefined ? {} : { bottom: range.bottom }), ...(range.top === undefined ? {} : { top: range.top }) })),
  ];
  const bands = places.map((place) => {
    const height = Math.ceil(lines * place.fontSize * CAPTION_LINE_HEIGHT + 2 * CAPTION_PILL_PADDING.y);
    return place.bottom !== undefined ? { top: input.frame.height - place.bottom - height, bottom: input.frame.height - place.bottom } : { top: place.top, bottom: place.top + height };
  });
  return { top: Math.min(...bands.map((band) => band.top)), bottom: Math.max(...bands.map((band) => band.bottom)) };
}

/** The film second an overlay starts at, or the reason its word cannot be found. */
function findOverlayStart(overlay: EdlOverlay, words: TimedWord[]): { ok: true; start: number } | { ok: false; error: string } {
  if (overlay.at !== undefined) return { ok: true, start: overlay.at };
  return findWordStart(overlay.at_word as NonNullable<EdlOverlay["at_word"]>, words, "at_word");
}

/** The film second a word of the transcript starts at, or why it is not there (`field` names it in the reason). */
function findWordStart(wanted: NonNullable<EdlOverlay["at_word"]>, words: TimedWord[], field: string, from?: number): { ok: true; start: number } | { ok: false; error: string } {
  const key = normalizeWord(wanted.text);
  const occurrence = wanted.occurrence ?? 1;
  const matches = words.filter((word) => normalizeWord(word.text) === key);
  // A list's point is said after the list starts (RV-192 of an adopting app): its occurrence counts from there, and only
  // a word the list never reaches falls back to the whole cut's count, as before.
  const after = from === undefined ? [] : matches.filter((word) => word.start >= from - WORD_START_TOLERANCE);
  const word = after[occurrence - 1] ?? matches[occurrence - 1];
  if (word === undefined) {
    const said = matches.length === 0 ? "the film never says it" : `the film says it ${matches.length} time${matches.length === 1 ? "" : "s"}`;
    return { ok: false, error: `${field}: no word "${wanted.text}"${occurrence > 1 ? ` (occurrence ${occurrence})` : ""} in the cut; ${said}` };
  }
  return { ok: true, start: word.start };
}

/** How far before a list's start its point's word may begin and still count as said after it: one frame at 30 fps. */
const WORD_START_TOLERANCE = 0.034;

const r1 = (value: number): number => Math.round(value * 10) / 10;
const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** A drawn overlay's padding round its text, in px: `OVERLAY_PADDING_EM` of its font size, scaled by its `padScale`. */
export function getOverlayPadding(overlay: { fontSize: number; padScale?: number }): { x: number; y: number } {
  const scale = overlay.padScale ?? 1;
  return { x: Math.round(overlay.fontSize * OVERLAY_PADDING_EM.x * scale), y: Math.round(overlay.fontSize * OVERLAY_PADDING_EM.y * scale) };
}

/** The estimated width of a line of text at a font size, in px (`OVERLAY_CHAR_EM` a letter). */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil([...text].length * OVERLAY_CHAR_EM * fontSize - 1e-6);
}

/** A line's width at a font size, in px. */
export type TextMeasure = (text: string, fontSize: number) => number;

/** How a note's line is measured: a card's handwriting from the hand font itself, a strip's capitals by their own wider average. */
export function getNoteMeasure(noteStyle: OverlayNoteStyle): TextMeasure {
  return noteStyle === "card" ? measureHandText : measureStripText;
}

/** A strip's capitals per character, in font sizes: bold capitals run about 0.72 em, plus the strip's letter spacing. */
export const NOTE_STRIP_CHAR_EM = 0.76;

/** How wide a strip's capitals are at `fontSize`: wider than `estimateTextWidth`'s mixed-case average. */
function measureStripText(text: string, fontSize: number): number {
  return Math.ceil([...text].length * NOTE_STRIP_CHAR_EM * fontSize - 1e-6);
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

type SideTextOverlay = Extract<ResolvedOverlay, { kind: "keyword" | "lower_third" | "list" }>;

/**
 * A keyword's, a lower third's or a list's lines as the draft draws them: a list's points with their bullets on a list
 * on its side; a centred stack and chips draw their points without bullets.
 */
export function getSideTextLines(overlay: SideTextOverlay): string[] {
  const hasBullets = overlay.kind === "list" && overlay.isCentred !== true && overlay.chips === undefined;
  const lines = overlay.kind === "list" ? overlay.items.map((item) => (hasBullets ? `• ${item}` : item)) : [overlay.text];
  return lines.map((line) => line.replace(/\s+/g, " ").trim());
}

/**
 * The card a drawn overlay shows, in px of the frame, or null for a `punch_in`. A keyword, a lower third and a list
 * are placed in the whole width they may take (`box`); their card fits their widest line (by `estimateTextWidth`)
 * plus its padding, on its side, as tall as the box. Every other kind's card is its box (`getOverlayBounds`). The
 * draft draws this card, so a report of where an overlay sits (does it cover a face?) reads the same box.
 */
export function getDrawnOverlayCard(overlay: ResolvedOverlay): OverlayBox | null {
  if (overlay.kind !== "keyword" && overlay.kind !== "lower_third" && overlay.kind !== "list") return getOverlayBounds(overlay);
  if (overlay.kind === "list" && overlay.chips !== undefined) return getBoxesUnion(overlay.chips);
  return getSideTextCard(overlay, getSideTextLines(overlay), overlay.box.height);
}

/** The card of a side text fitted to `lines`, `height` tall from the box's top: on its side, or in the box's middle (a centred list or keyword). */
function getSideTextCard(overlay: SideTextOverlay, lines: readonly string[], height: number): OverlayBox {
  const { box, fontSize, side } = overlay;
  const padX = getOverlayPadding(overlay).x;
  const textWidth = Math.max(0, ...lines.map((line) => estimateTextWidth(line, fontSize)));
  const width = Math.min(box.width, Math.ceil(textWidth + 2 * padX));
  const isCentred = (overlay.kind === "list" || overlay.kind === "keyword") && overlay.isCentred === true;
  const left = isCentred ? box.left + Math.round((box.width - width) / 2) : side === "right" ? box.left + box.width - width : box.left;
  return { left, top: box.top, width, height };
}

/** The smallest box round every box of a non-empty list. */
function getBoxesUnion(boxes: readonly OverlayBox[]): OverlayBox {
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * A list's drawn boxes after each point has come in (RV-144 of an adopting app): `cards[i]` is what shows once points
 * 0 to i are in. A stack's card grows with each point, fitted to the points in so far (one line taller, as wide as the
 * widest), so it never stands sized for the whole list nor empty: its first point comes in with it. Chips add one
 * card at a time, and the chips shown so far are always a row of their own on the frame's axis (`chipAxis`, RV-185 of
 * an adopting app), as close to it as the box allows, their sizes and gaps kept; the last step is the full row
 * (`overlay.chips`) exactly. Every entry holds one box per drawn card.
 */
export function getListCardsByItem(overlay: Extract<ResolvedOverlay, { kind: "list" }>): OverlayBox[][] {
  if (overlay.chips !== undefined) {
    const chips = overlay.chips;
    const first = (chips[0] as OverlayBox).left;
    const axis = overlay.chipAxis ?? (first + getChipRight(chips[chips.length - 1] as OverlayBox)) / 2;
    const { box } = overlay;
    return chips.map((chip, index) => {
      if (index === chips.length - 1) return chips;
      const width = getChipRight(chip) - first;
      const left = Math.round(Math.max(box.left, Math.min(box.left + box.width - width, axis - width / 2)));
      return chips.slice(0, index + 1).map((shown) => ({ ...shown, left: shown.left - first + left }));
    });
  }
  const lines = getSideTextLines(overlay);
  const padY = getOverlayPadding(overlay).y;
  return lines.map((_line, index) => {
    const height = index === lines.length - 1 ? overlay.box.height : Math.ceil((index + 1) * overlay.fontSize * OVERLAY_LIST_LINE_HEIGHT + 2 * padY);
    return [getSideTextCard(overlay, lines.slice(0, index + 1), height)];
  });
}

/** A chip's right edge, in px of the frame. */
function getChipRight(chip: OverlayBox): number {
  return chip.left + chip.width;
}

/**
 * Which step of `getListCardsByItem` shows from each distinct second a list's points come in at (RV-185 of an adopting
 * app): points on the same second come in together, so the step is the last of them. In time order, the first at the
 * list's start.
 */
export function getListStops(overlay: Extract<ResolvedOverlay, { kind: "list" }>): { at: number; step: number }[] {
  const times = getListItemTimes(overlay);
  return times.flatMap((at, step) => (times[step + 1] === at ? [] : [{ at, step }]));
}

/** The film seconds each point of a list comes in at: its own (`itemStarts`), the first with the card; else all with the card. */
export function getListItemTimes(overlay: Extract<ResolvedOverlay, { kind: "list" }>): number[] {
  return overlay.items.map((_item, index) => (index === 0 ? overlay.start : (overlay.itemStarts?.[index] ?? overlay.start)));
}

/**
 * Why the cut that starts segment `index` ends a shot, or null for a jump cut inside one shot (RV-136 of an adopting
 * app): the segment plays the same clip as the one before, starts on a plain `cut`, neither has a Ken Burns zoom, and
 * both keep the same caption box. Only across such a cut does the frame stay the same, so an overlay may run on.
 */
export function findShotBreak(edl: Pick<Edl, "segments">, index: number): string | null {
  const segment = edl.segments[index];
  const previous = edl.segments[index - 1];
  if (segment === undefined || previous === undefined) return "the cut's end";
  if (segment.clip !== previous.clip) return `segment "${segment.id}" plays another clip`;
  if (segment.transition !== "cut") return `segment "${segment.id}" starts on a ${segment.transition}, not a plain cut`;
  if (segment.motion === "kenburns" || previous.motion === "kenburns") return `a Ken Burns zoom at segment "${segment.id}"`;
  if (isCameraMoving(segment.camera) || isCameraMoving(previous.camera) || !isSameCamera(segment.camera, previous.camera)) return `a camera move or a new framing at segment "${segment.id}"`;
  if (segment.caption?.bottom !== previous.caption?.bottom || segment.caption?.top !== previous.caption?.top) return `segment "${segment.id}" moves the captions`;
  return null;
}

/**
 * The film seconds an overlay starting in `segment` may reach: on across every jump cut inside one shot
 * (`findShotBreak`) until `end`, then the first cut that breaks the shot with its reason. A punch-in zooms its own
 * segment's picture, so it never crosses a cut.
 */
function findShotSpan(edl: Edl, starts: readonly number[], at: { segment: number; end: number; isPunchIn: boolean }): { last: number; end: number; reason: string } {
  const getEnd = (index: number): number => r3((starts[index] as number) + ((edl.segments[index]?.end ?? 0) - (edl.segments[index]?.start ?? 0)));
  let last = at.segment;
  for (;;) {
    const reason = at.isPunchIn ? "a punch-in stays in its segment" : findShotBreak(edl, last + 1);
    if (reason !== null || at.end <= getEnd(last) + 0.01) return { last, end: getEnd(last), reason: reason ?? "" };
    last += 1;
  }
}

/**
 * The overlays of an EDL resolved to film time and placed, or every reason one cannot be drawn: its word is not said,
 * it is too short or runs past the cut or across a cut that changes the shot (`findShotBreak`: another clip, a
 * transition, a Ken Burns zoom, moved captions; a `hook_title` may stay across any cut, a `punch_in` across none), two overlap,
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
    const segmentId = edl.segments[segment]?.id ?? "";
    const split = edl.segments.findIndex((candidate, i) => candidate.split !== undefined && (starts[i] as number) < end - 0.001 && start < (starts[i] as number) + candidate.end - candidate.start - 0.001);
    if (split !== -1) {
      problems.push(`${at}: segment "${edl.segments[split]?.id ?? ""}" is a split screen with its own labels and arrows; keep overlays off it`);
      return;
    }
    if (!isTitleBand(overlay.kind)) {
      const shot = findShotSpan(edl, starts, { segment, end, isPunchIn: overlay.kind === "punch_in" });
      if (end > shot.end + 0.01) {
        const inside = shot.last === segment ? `segment "${segmentId}"` : `segments "${segmentId}" to "${edl.segments[shot.last]?.id ?? ""}"`;
        problems.push(`${at}: runs ${r1(end - shot.end)} s past the cut at ${shot.end} s (${shot.reason}); keep it inside ${inside} (${segmentStart}-${shot.end} s) or shorten it`);
        return;
      }
    }
    const base = { index, start, end, segment };
    const placed = placeOverlay(overlay, base, { zone, frame, band: getCaptionBand(input, base), padScale: STYLE_PADDING_SCALES[input.style?.padding ?? "m"] });
    if (!placed.ok) {
      problems.push(`${at}: ${placed.error}`);
      return;
    }
    // Chips always come in one by one, as a countdown of the points (RV-181 of an adopting app); a stack only when asked.
    const isStaggered = overlay.style?.stagger === true || overlay.item_words !== undefined || overlay.item_at !== undefined;
    if (placed.overlay.kind === "list" && (isStaggered || placed.overlay.chips !== undefined)) {
      const said = (overlay.item_words ?? []).map((word, item) => findWordStart(word, input.words, `item_words[${item}]`, start));
      const missing = said.flatMap((word) => (word.ok ? [] : [word.error]));
      if (missing.length > 0) {
        problems.push(...missing.map((error) => `${at}.${error}`));
        return;
      }
      const times = overlay.item_at ?? (overlay.item_words === undefined ? undefined : said.map((word) => (word as { start: number }).start));
      // The first point comes in with the card, so the card never stands empty (RV-144 of an adopting app).
      placed.overlay.itemStarts = getListItemStarts({ start, end, count: placed.overlay.items.length, ...(times === undefined ? {} : { words: times }) }).map((at, item) => (item === 0 ? start : at));
    }
    if (placed.overlay.kind === "note") {
      const timed = timeNote(placed.overlay, input.words);
      placed.overlay.wordTimes = timed.wordTimes;
      placed.overlay.tickAt = timed.tickAt;
    }
    if (placed.overlay.kind === "punch_in") {
      if (edl.segments[segment]?.motion === "kenburns") {
        problems.push(`${at}: segment "${segmentId}" has a Ken Burns zoom, which owns the picture's scale; put the punch-in on a still segment`);
        return;
      }
      if (edl.segments[segment]?.camera !== undefined) {
        problems.push(`${at}: segment "${segmentId}" has a camera (a move or a framing), which owns the picture's scale; put the punch-in on a segment without one`);
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

/** The kinds that live in the top band (a hook title, an end word): not counted against one overlay at a time. */
export function isTitleBand(kind: OverlayKind): boolean {
  return kind === "hook_title" || kind === "end_word";
}

/** Whether two overlays are on screen at the same time. */
function isConcurrent(a: ResolvedOverlay, b: ResolvedOverlay): boolean {
  return a.start < b.end - 0.001 && b.start < a.end - 0.001;
}

/** Two overlays on screen at once, two too close, two hook titles at once, or a drawing on a hook title while it shows. */
function findTimingProblems(ordered: readonly ResolvedOverlay[], spacing: number): string[] {
  const problems: string[] = [];
  const counted = ordered.filter((overlay) => !isTitleBand(overlay.kind));
  counted.forEach((overlay, place) => {
    const previous = counted[place - 1];
    if (previous === undefined) return;
    if (overlay.start < previous.end - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts at ${overlay.start} s while overlays[${previous.index}] is on screen (until ${previous.end} s); one overlay at a time`);
    } else if (overlay.start - previous.start < spacing - 0.001) {
      problems.push(`overlays[${overlay.index}]: starts ${r1(overlay.start - previous.start)} s after overlays[${previous.index}]; the film keeps overlays ${spacing} s apart (overlayMinSpacing)`);
    }
  });
  const titles = ordered.filter((overlay): overlay is Extract<ResolvedOverlay, { kind: "hook_title" | "end_word" }> => isTitleBand(overlay.kind));
  titles.forEach((title, place) => {
    const name = title.kind.replace("_", " ");
    const previous = titles[place - 1];
    if (previous !== undefined && isConcurrent(title, previous)) {
      problems.push(`overlays[${title.index}]: starts at ${title.start} s while the ${previous.kind.replace("_", " ")} overlays[${previous.index}] is on screen (until ${previous.end} s); one title at the top at a time`);
    }
    const titleBox = title.box;
    for (const other of counted) {
      const bounds = getOverlayBounds(other);
      if (bounds === null || !isConcurrent(title, other) || !isOverlapping(bounds, titleBox)) continue;
      problems.push(`overlays[${other.index}]: the ${other.kind.replace("_", " ")} would sit on the ${name} overlays[${title.index}] (on screen until ${title.end} s); move it lower or start it after the ${name}`);
    }
  });
  return problems;
}

interface Placement {
  zone: { top: number; bottom: number; left: number; right: number };
  frame: { width: number; height: number };
  band: { top: number; bottom: number } | null;
  /** Every card's padding scale (`STYLE_PADDING_SCALES` of the brand's `padding`). */
  padScale: number;
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

/**
 * The left edge of a box `width` wide centred on the frame's vertical axis, as the captions are: the platform safe
 * zone's sides differ (60 px on the left, up to 150 px on the right), so the middle of the zone sits left of the
 * frame's middle (RV-180 of an adopting app). A box no wider than `getCentredSpan` is exactly centred; a wider one
 * (a note, whose room is a share of the whole zone) is pushed inwards only as far as the zone needs.
 */
export function getCentredLeft(place: Pick<Placement, "zone" | "frame">, width: number, margin: number): number {
  const { zone, frame } = place;
  const lowest = zone.left + margin;
  const highest = frame.width - zone.right - margin - width;
  return Math.round(Math.max(lowest, Math.min(highest, (frame.width - width) / 2)));
}

/** The widest box centred on the frame's axis that stays inside the safe zone: the wider side taken on both edges. */
function getCentredSpan(place: Pick<Placement, "zone" | "frame">, margin: number): { left: number; width: number } {
  const side = Math.max(place.zone.left, place.zone.right) + margin;
  return { left: side, width: place.frame.width - 2 * side };
}

/**
 * A centred overlay measured so it can sit on the frame's axis: in the whole zone's width as before when it is no
 * wider than the centred span, else again in the centred span (smaller or on more lines), and only when it cannot fit
 * there either in the whole zone, as close to the axis as the zone allows. What fitted before still fits.
 */
function measureCentred<T extends { ok: true } | { ok: false; error: string }>(input: {
  whole: number;
  centred: number;
  /** Measures in `room`; `isCentred` is true for the second measure, in the centred span. */
  measure: (room: number, isCentred: boolean) => T;
  getWidth: (result: T & { ok: true }) => number;
  /** Measure in the centred span also when the whole zone refuses it (a measure that fits more there, a place card). */
  isRetriedWhenRefused?: boolean;
}): T {
  const wide = input.measure(input.whole, false);
  if (!wide.ok && input.isRetriedWhenRefused !== true) return wide;
  if (wide.ok && input.getWidth(wide as T & { ok: true }) <= input.centred) return wide;
  const narrow = input.measure(input.centred, true);
  return narrow.ok ? narrow : wide;
}

/** The top of a box `height` tall at a named position of the text region. */
function getPositionTop(region: { top: number; bottom: number }, position: OverlayPosition, height: number): number {
  if (position === "top") return region.top;
  if (position === "bottom") return region.bottom - height;
  return Math.round(region.top + (region.bottom - region.top) * 0.4 - height / 2);
}

function getLook(overlay: EdlOverlay): OverlayLook {
  const style = overlay.style ?? {};
  return {
    entrance: style.entrance ?? null,
    typing: isTypedOverlay(overlay) ? (style.typing_speed ?? DEFAULT_OVERLAY_TYPING_SPEED) : null,
    colors: { ...style.colors },
    cornerRadius: style.corner_radius ?? null,
    ...(style.exit === undefined || style.exit === "auto" ? {} : { exit: style.exit }),
    ...(style.easing === undefined || style.easing === "smooth" ? {} : { easing: style.easing }),
  };
}

function placeOverlay(overlay: EdlOverlay, base: OverlayBase, place: Placement): Placed {
  if (overlay.kind === "punch_in") {
    const ease = r3(Math.min(PUNCH_IN_EASE_SECONDS, (base.end - base.start) / 2));
    return { ok: true, overlay: { ...base, kind: "punch_in", scale: PUNCH_IN_SCALES[overlay.style?.size ?? "m"], ease } };
  }
  const drawn = { ...base, ...getLook(overlay), ...(place.padScale === 1 ? {} : { padScale: place.padScale }) };
  if (overlay.kind === "arrow" || overlay.kind === "highlight") return placeMark(overlay, drawn, place);
  if (overlay.kind === "keyword" || overlay.kind === "lower_third" || overlay.kind === "list") return placeSideText({ ...overlay, kind: overlay.kind }, drawn, place);
  if (overlay.kind === "note") return placeNote(overlay, drawn, place);
  if (overlay.kind === "end_word") return placeEndWord(overlay, drawn, place);
  return placeCard({ ...overlay, kind: overlay.kind }, drawn, place);
}

/** A note's lines: broken at spaces to fit `width`, at most `MAX_NOTE_LINE_WORDS` words a line; null when a word alone is wider. */
export function wrapNoteText(text: string, fontSize: number, width: number, measure: TextMeasure = estimateTextWidth): string[] | null {
  const lines: string[][] = [];
  for (const word of text.split(/\s+/).filter((part) => part.length > 0)) {
    if (measure(word, fontSize) > width) return null;
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length < MAX_NOTE_LINE_WORDS && measure([...last, word].join(" "), fontSize) <= width) last.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => line.join(" "));
}

/** A number from 0 to 1 for each of `count` points, the same for the same text: a torn edge that is not a pattern. */
export function getTornEdge(text: string, count = NOTE_TEAR_POINTS): number[] {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16777619) >>> 0;
  return Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return r3(0.25 + 0.75 * (seed / 4294967296));
  });
}

/** A note's tick size and the gap before it, in px. */
export function getNoteTickSize(fontSize: number): { size: number; gap: number } {
  return { size: Math.round(fontSize * NOTE_TICK_EM.size), gap: Math.round(fontSize * NOTE_TICK_EM.gap) };
}

/** A note's padding round its text, in px. */
export function getNotePadding(fontSize: number): { x: number; y: number; tear: number } {
  return { x: Math.round(fontSize * NOTE_PADDING_EM.x), y: Math.round(fontSize * NOTE_PADDING_EM.y), tear: Math.round(fontSize * NOTE_TEAR_EM) };
}

/** A note's text block inside its paper: its left edge and top, in px (the tear takes the card's foot, the strip's top). */
export function getNoteTextBox(note: Pick<Extract<ResolvedOverlay, { kind: "note" }>, "box" | "fontSize" | "noteStyle" | "lines">): OverlayBox {
  const pad = getNotePadding(note.fontSize);
  const top = note.box.top + pad.y + (note.noteStyle === "strip" ? pad.tear : 0);
  return { left: note.box.left + pad.x, top, width: note.box.width - 2 * pad.x, height: note.lines.length * note.fontSize * NOTE_LINE_HEIGHT };
}

/**
 * A note: a paper card (handwritten, its words coming in as they are said) or a strip (typed capitals), on its side
 * in the top or the middle of the room above the captions, at most `NOTE_WIDTH_SHARE` of the safe width; a text that
 * takes more than `MAX_NOTE_LINES` lines is refused.
 */
function placeNote(overlay: EdlOverlay, drawn: Drawn, place: Placement): Placed {
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  const noteStyle = overlay.style?.note_style ?? "card";
  const size = overlay.style?.size ?? "m";
  const fontSize = Math.round((noteStyle === "strip" ? NOTE_STRIP_FONT_SIZES : OVERLAY_FONT_SIZES.note)[size] * scale);
  const pad = getNotePadding(fontSize);
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const room = Math.round((frame.width - zone.left - zone.right - 2 * margin) * NOTE_WIDTH_SHARE) - 2 * pad.x;
  const text = noteStyle === "strip" ? (overlay.text ?? "").toUpperCase() : (overlay.text ?? "");
  const measure = getNoteMeasure(noteStyle);
  const lines = wrapNoteText(text, fontSize, room, measure);
  if (lines === null) return { ok: false, error: "a word of the note is too wide for its card; shorten it or use a smaller size" };
  if (lines.length > MAX_NOTE_LINES) return { ok: false, error: `the note takes ${lines.length} lines, more than ${MAX_NOTE_LINES}; shorten it or use a smaller size` };
  const isTick = overlay.style?.tick === true;
  const tick = getNoteTickSize(fontSize);
  const lastWidth = measure(lines[lines.length - 1] ?? "", fontSize) + (isTick ? tick.gap + tick.size : 0);
  const contentWidth = Math.max(lastWidth, ...lines.map((line) => measure(line, fontSize)));
  if (contentWidth > room) return { ok: false, error: "the note's last line and its tick are too wide for its card; shorten it or leave the tick out" };
  const width = Math.ceil(contentWidth + 2 * pad.x);
  const height = Math.ceil(lines.length * fontSize * NOTE_LINE_HEIGHT + 2 * pad.y + pad.tear);
  const region = getTextRegion(place);
  const top = getPositionTop(region, overlay.style?.position ?? "top", height);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the note (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or shorter text` };
  }
  // Without a side the note sits on the frame's axis, leaning half as much (RV-182 of an adopting app).
  const side = overlay.style?.side ?? "center";
  const left = side === "center" ? getCentredLeft(place, width, margin) : side === "right" ? frame.width - zone.right - margin - width : zone.left + margin;
  const tilt = side === "center" ? NOTE_TILT[noteStyle] / 2 : (side === "right" ? -1 : 1) * NOTE_TILT[noteStyle];
  return {
    ok: true,
    overlay: { ...drawn, kind: "note", noteStyle, lines, fontSize, side, box: { left, top, width, height }, tilt, tear: getTornEdge(text), wordTimes: null, tick: isTick, tickAt: null },
  };
}

/**
 * A note card's word times and its tick's start: each word of the note comes in on the same word said inside its span
 * (matched in order, compared like fillers are), a word not said with the one before it; when none is said, the words
 * are spaced over the first part of the span. The card is there one frame before its first word, and no word comes
 * later than 0.6 s before its end. A strip types its text (`getTypingTimes`), its tick after its last letter.
 */
export function timeNote(note: Extract<ResolvedOverlay, { kind: "note" }>, words: readonly TimedWord[]): { wordTimes: number[] | null; tickAt: number | null } {
  // The tick comes after the last word, but never in the note's last 0.4 s nor before it starts.
  const tickAfter = (at: number): number | null => (note.tick ? r3(Math.max(note.start, Math.min(note.end - 0.4, at + NOTE_TICK_DELAY))) : null);
  const noteWords = note.lines.join(" ").split(" ");
  const first = r3(note.start + NOTE_FIRST_WORD_LEAD);
  const latest = r3(Math.max(first, note.end - 0.6));
  if (note.noteStyle === "strip") {
    const typed = note.typing ?? DEFAULT_OVERLAY_TYPING_SPEED;
    const lastLetter = note.start + 0.3 + ([...note.lines.join("")].length - 1) / typed;
    return { wordTimes: null, tickAt: tickAfter(lastLetter) };
  }
  const said = words.filter((word) => word.start >= note.start - 0.05 && word.start < note.end);
  let cursor = 0;
  let previous: number | null = null;
  const matched = noteWords.map((word) => {
    const key = normalizeWord(word);
    const found = said.findIndex((spoken, index) => index >= cursor && normalizeWord(spoken.text) === key);
    if (found === -1) return previous;
    cursor = found + 1;
    previous = said[found]?.start ?? null;
    return previous;
  });
  const isSaid = matched.some((time) => time !== null);
  const gap = Math.min(0.35, Math.max(0.12, ((note.end - note.start) * 0.5) / noteWords.length));
  const times = noteWords.map((_word, index) => {
    const at = isSaid ? (matched[index] ?? first) : first + index * gap;
    return r3(Math.min(latest, Math.max(first, at)));
  });
  // Never earlier than the word before: a later word matched before an earlier one keeps the reading order.
  for (let index = 1; index < times.length; index++) times[index] = Math.max(times[index] as number, times[index - 1] as number);
  return { wordTimes: times, tickAt: tickAfter(times[times.length - 1] ?? first) };
}

/** An end word: one big handwritten line at the top of the room, no card, shrunk to fit the width or refused. */
function placeEndWord(overlay: EdlOverlay, drawn: Drawn, place: Placement): Placed {
  const { zone, frame } = place;
  const scale = frame.width / 1080;
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const text = (overlay.text ?? "").replace(/\s+/g, " ").trim();
  const own = Math.round(OVERLAY_FONT_SIZES.end_word[overlay.style?.size ?? "m"] * scale);
  const fitted = measureCentred({
    whole: frame.width - zone.left - zone.right - 2 * margin,
    centred: getCentredSpan(place, margin).width,
    measure: (room: number): { ok: true; fontSize: number } | { ok: false; error: string } => {
      let fontSize = own;
      for (let shrink = 0; measureHandText(text, fontSize) > room; shrink++) {
        if (shrink === MAX_TITLE_SHRINKS) return { ok: false, error: "the end word is too wide for one line even at a smaller size; shorten it or use a smaller size" };
        fontSize = Math.round(fontSize * OVERLAY_TITLE_SHRINK);
      }
      return { ok: true, fontSize };
    },
    getWidth: (result) => measureHandText(text, result.fontSize),
  });
  if (!fitted.ok) return fitted;
  const { fontSize } = fitted;
  const width = measureHandText(text, fontSize);
  const height = Math.ceil(fontSize * OVERLAY_LINE_HEIGHT);
  const region = getTextRegion(place);
  if (region.top + height > region.bottom) return { ok: false, error: `the end word (${height} px tall) does not fit above the captions; use a smaller size` };
  const left = getCentredLeft(place, width, margin);
  return { ok: true, overlay: { ...drawn, kind: "end_word", text, fontSize, box: { left, top: region.top, width, height } } };
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
  const align = overlay.kind === "keyword" ? overlay.style?.align : undefined;
  // A keyword's align left or right is its side; center puts its card in the middle (`isCentred`).
  const side = align === "left" || align === "right" ? align : (overlay.style?.side ?? (overlay.kind === "keyword" ? "right" : "left"));
  const fontSize = Math.round(OVERLAY_FONT_SIZES[overlay.kind][overlay.style?.size ?? "m"] * scale);
  const pad = getOverlayPadding({ fontSize, padScale: place.padScale });
  const margin = Math.round(OVERLAY_MARGIN * scale);
  const room = frame.width - zone.left - zone.right - 2 * margin;
  const chips = overlay.kind === "list" ? measureCentred({
          whole: room,
          centred: getCentredSpan(place, margin).width,
          measure: (width: number, isCentred: boolean) =>
            getListChipLayout({ items: overlay.items ?? [], layout: overlay.style?.list_layout ?? "stack", fontSize, minFontSize: Math.round((isCentred ? LIST_CHIP_CENTRED_MIN_FONT_SIZE : LIST_CHIP_MIN_FONT_SIZE) * scale), padScale: place.padScale, room: width }),
          getWidth: (result) => result.row?.width ?? 0,
          // A row refused in the whole zone may still fit the centred span a little smaller.
          isRetriedWhenRefused: true,
        }) : null;
  if (chips !== null && !chips.ok) return chips;
  const row = chips?.row ?? null;
  const lines = overlay.kind === "list" ? (overlay.items ?? []).length : 1;
  const lineHeight = overlay.kind === "list" ? OVERLAY_LIST_LINE_HEIGHT : OVERLAY_LINE_HEIGHT;
  const height = row === null ? Math.ceil(lines * fontSize * lineHeight + 2 * pad.y) : row.height;
  const region = getTextRegion(place);
  // Without a position, each kind's own place: the lower third on the captions' room, the keyword in the middle, the list high.
  const position = overlay.style?.position ?? (overlay.kind === "lower_third" ? "bottom" : overlay.kind === "keyword" ? "middle" : null);
  const top = position === null ? Math.round(region.top + (region.bottom - region.top) * 0.15) : getPositionTop(region, position, height);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the ${overlay.kind.replace("_", " ")} (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or fewer points` };
  }
  const box = { left: zone.left + margin, top, width: room, height };
  // A centred card (a stack without a side, a keyword aligned center) sits in a box centred on the frame's axis.
  const centred = { ...box, ...getCentredSpan(place, margin) };
  if (overlay.kind === "list") {
    const isCentred = row === null && overlay.style?.side === undefined;
    const layout = row !== null ? { chips: placeChipRow(row, { ...box, left: getCentredLeft(place, row.width, margin), width: row.width }), chipAxis: place.frame.width / 2 } : isCentred ? { isCentred: true } : {};
    // A row of chips may be drawn smaller than the list's size, to fit one row.
    return { ok: true, overlay: { ...drawn, kind: "list", items: overlay.items ?? [], fontSize: row?.fontSize ?? fontSize, side, box: isCentred ? centred : box, ...layout } };
  }
  const fields = { text: overlay.text ?? "", fontSize, side, box: align === "center" ? centred : box };
  if (overlay.kind === "lower_third") return { ok: true, overlay: { ...drawn, kind: "lower_third", ...fields } };
  return {
    ok: true,
    overlay: {
      ...drawn,
      kind: "keyword",
      ...fields,
      ...(overlay.style?.underline === true ? { underline: true } : {}),
      ...(align === "center" ? { isCentred: true } : {}),
      ...(overlay.style?.backdrop === "highlight" ? { backdrop: "highlight" as const } : {}),
    },
  };
}

/** A list's chips before they are placed: their type size, each one's width, their common height, the row's width with its gaps. */
interface ChipRow {
  fontSize: number;
  widths: number[];
  height: number;
  gap: number;
  width: number;
}

/** A row of chips at one type size. */
function measureChipRow(items: readonly string[], fontSize: number, padScale: number): ChipRow {
  const pad = getOverlayPadding({ fontSize, padScale });
  const badge = getChipBadgeSize(fontSize);
  // The badge sits as far from the chip's left edge as from its top, so the left takes the vertical padding.
  const widths = items.map((item) => Math.ceil(estimateTextWidth(item, fontSize) + pad.y + pad.x + badge.size + badge.gap));
  const gap = Math.round(fontSize * LIST_CHIP_GAP_EM);
  const width = widths.reduce((sum, chip) => sum + chip, 0) + gap * Math.max(0, widths.length - 1);
  return { fontSize, widths, height: Math.ceil(fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y), gap, width };
}

/**
 * Whether a list draws as chips and their row (null: the stack), or why it cannot. A row wider than `room` is tried
 * smaller, as a title is (by `OVERLAY_TITLE_SHRINK`, `MAX_TITLE_SHRINKS` times; an asked row of chips then on while its type
 * stays at or above `minFontSize`); one that never fits is refused on `chips`, and `auto` falls back to the stack at the list's
 * own size. `stack` never draws chips.
 */
function getListChipLayout(input: { items: readonly string[]; layout: OverlayListLayout; fontSize: number; minFontSize: number; padScale: number; room: number }): { ok: true; row: ChipRow | null } | { ok: false; error: string } {
  const { items, layout, room } = input;
  if (layout === "stack") return { ok: true, row: null };
  const own = measureChipRow(items, input.fontSize, input.padScale);
  for (let shrink = 0, row = own; ; shrink++) {
    if (row.width <= room) return { ok: true, row };
    const smaller = Math.round(row.fontSize * OVERLAY_TITLE_SHRINK);
    // `auto` has the stack to fall back to, so only an asked row of chips shrinks past a title's three steps.
    if (shrink >= MAX_TITLE_SHRINKS && (layout === "auto" || smaller < input.minFontSize)) break;
    row = measureChipRow(items, smaller, input.padScale);
  }
  if (layout === "auto") return { ok: true, row: null };
  return { ok: false, error: `the list's points as chips (${own.width} px) do not fit one row (${room} px) even at a smaller size; use list_layout stack or auto, or shorter points` };
}

/** A chip's step badge: its diameter and the room after it, in px. */
export function getChipBadgeSize(fontSize: number): { size: number; gap: number } {
  return { size: Math.round(fontSize * LIST_CHIP_BADGE_EM.size), gap: Math.round(fontSize * LIST_CHIP_BADGE_EM.gap) };
}

/**
 * A chip's parts (RV-181 of an adopting app): its step badge, a round mark on the chip's left, and the centre its point
 * is written about, in the room after the badge.
 */
export function getChipParts(chip: OverlayBox, overlay: { fontSize: number; padScale?: number }): { badge: { centre: OverlayPoint; radius: number }; textX: number } {
  const pad = getOverlayPadding(overlay);
  const badge = getChipBadgeSize(overlay.fontSize);
  const radius = badge.size / 2;
  const textLeft = chip.left + pad.y + badge.size + badge.gap;
  return { badge: { centre: { x: chip.left + pad.y + radius, y: chip.top + chip.height / 2 }, radius }, textX: r1(textLeft + (chip.left + chip.width - pad.x - textLeft) / 2) };
}

/** The three points of the tick that takes a covered chip's number's place, inside its badge. */
export function getChipTickPoints(badge: { centre: OverlayPoint; radius: number }): OverlayPoint[] {
  const { centre, radius } = badge;
  return [
    { x: r1(centre.x - 0.42 * radius), y: r1(centre.y + 0.02 * radius) },
    { x: r1(centre.x - 0.1 * radius), y: r1(centre.y + 0.32 * radius) },
    { x: r1(centre.x + 0.44 * radius), y: r1(centre.y - 0.3 * radius) },
  ];
}

/**
 * When each chip of a row is covered: the first second a later point comes in after it, after which the chip steps
 * back (its point fainter, its number a tick) and the newest point leads, as a countdown does. So every point before
 * the one leading is ticked, in order, even when two came in together (RV-192 of an adopting app). Null for the
 * points that lead last, and for one whose next point comes in only after the list has gone.
 */
export function getChipCoveredTimes(overlay: Extract<ResolvedOverlay, { kind: "list" }>): (number | null)[] {
  const times = getListItemTimes(overlay);
  return times.map((at, index) => {
    const next = times.slice(index + 1).find((later) => later > at);
    return next !== undefined && next < overlay.end ? next : null;
  });
}

/** The chips of a row in their final places: centred in `box`, left to right in the points' order. */
function placeChipRow(row: ChipRow, box: OverlayBox): OverlayBox[] {
  let left = box.left + Math.round((box.width - row.width) / 2);
  return row.widths.map((width) => {
    const chip = { left, top: box.top, width, height: row.height };
    left += width + row.gap;
    return chip;
  });
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
  /** The frame's width / 1080. */
  scale: number;
}

const tooWide = (metrics: CardMetrics, what: string): CardResult => ({ ok: false, error: `the ${metrics.label}'s ${what} is too wide for one line; shorten it or use a smaller size` });

/**
 * A title's lines at a font size: two lines balanced so neither is much wider than the other (the narrower the
 * wider of the two, the better), or the greedy wrap when it takes one line or more than two.
 */
export function wrapOverlayTitle(text: string, fontSize: number, width: number): string[] {
  const lines = wrapOverlayText(text, fontSize, width);
  if (lines.length !== 2) return lines;
  const words = text.split(/\s+/).filter((part) => part.length > 0);
  let best = lines;
  let bestWidth = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)));
  for (let split = 1; split < words.length; split++) {
    const pair = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
    const widest = Math.max(...pair.map((line) => estimateTextWidth(line, fontSize)));
    if (widest < bestWidth) [best, bestWidth] = [pair, widest];
  }
  return best;
}

/**
 * A title's lines and font size: its own size, else smaller by `OVERLAY_TITLE_SHRINK` until it fits two lines, at most
 * `maxShrinks` times; null when it never does.
 */
function fitTitle(text: string, fontSize: number, room: number, maxShrinks = MAX_TITLE_SHRINKS): { lines: string[]; fontSize: number } | null {
  for (let shrink = 0, size = fontSize; shrink <= maxShrinks; shrink++, size = Math.round(size * OVERLAY_TITLE_SHRINK)) {
    const lines = wrapOverlayTitle(text, size, room);
    if (lines.length <= MAX_OVERLAY_TITLE_LINES && lines.every((line) => estimateTextWidth(line, size) <= room)) return { lines, fontSize: size };
  }
  return null;
}

/**
 * A place card's subtitle size: its `subtitle_size` of the title, at least `MIN_OVERLAY_SUBTITLE_PX`; a subtitle too
 * long for that shrinks to fit `room`, never below the `s` step (the size every subtitle had before, so nothing that
 * fitted then is refused now).
 */
function getSubtitleSize(input: { subtitle: string; titleSize: number; step: OverlaySize; room: number; scale: number; isCentred?: boolean }): number {
  const smallest = Math.round(MIN_OVERLAY_SUBTITLE_PX * input.scale);
  const wanted = Math.max(smallest, Math.round(input.titleSize * OVERLAY_SUBTITLE_SCALES[input.step]));
  const fitting = Math.floor(input.room / ([...input.subtitle].length * OVERLAY_CHAR_EM));
  // In the centred span a subtitle may go down to `MIN_OVERLAY_SUBTITLE_PX` too when the `s` step is above it.
  const floor = Math.round(input.titleSize * OVERLAY_SUBTITLE_SCALES.s);
  return Math.min(wanted, Math.max(fitting, input.isCentred === true ? Math.min(floor, smallest) : floor));
}

/**
 * A place card's subtitle: one line at `getSubtitleSize` when it fits `room` (what fitted before keeps its size), else
 * two balanced lines, each sized as one line would be; null when even two lines are too wide (RV-184 of an adopting
 * app: a card whose subtitle cannot fit the centred span is placed off the frame's axis).
 */
function fitPlaceSubtitle(input: { subtitle: string; titleSize: number; step: OverlaySize; room: number; scale: number; isCentred: boolean }): { lines: string[]; size: number } | null {
  const size = getSubtitleSize(input);
  if (estimateTextWidth(input.subtitle, size) <= input.room) return { lines: [input.subtitle], size };
  const lines = splitInTwoLines(input.subtitle);
  if (lines === null) return null;
  const longest = lines.reduce((widest, line) => ([...line].length > [...widest].length ? line : widest));
  const lineSize = getSubtitleSize({ ...input, subtitle: longest });
  return lines.every((line) => estimateTextWidth(line, lineSize) <= input.room) ? { lines, size: lineSize } : null;
}

/** A text's two lines of words as even as they can be (the longer line as short as it can be); null for one word. */
function splitInTwoLines(text: string): [string, string] | null {
  const words = text.split(/\s+/).filter((part) => part.length > 0);
  if (words.length < 2) return null;
  let best: [string, string] = [words[0] as string, words.slice(1).join(" ")];
  for (let split = 2; split < words.length; split++) {
    const pair: [string, string] = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
    if (Math.max(...pair.map((line) => [...line].length)) < Math.max(...best.map((line) => [...line].length))) best = pair;
  }
  return best;
}

/** A place card's title may shrink this many steps more in the centred span than in the whole zone (0.9² ≈ 0.81). */
const CENTRED_TITLE_EXTRA_SHRINKS = 2;

/** A hook title's or a place card's second line: the place label (with its pin) or the subtitle. */
type TitleOverlay = Extract<ResolvedOverlay, { kind: "hook_title" | "place_card" }>;

/**
 * The text block of a hook title or a place card without its padding, in px: its widest line (the place label with
 * its pin, the subtitle, each title line) and its height. Its card is this plus the padding, so the draft and the
 * render find the block's left edge and top inside the card from it whatever the title's fitted size.
 */
export function getTitleContentSize(input: {
  kind: TitleOverlay["kind"];
  lines: readonly string[];
  fontSize: number;
  second: string | null;
  secondSize: number;
  pin?: boolean;
  /** A place card's wrapped subtitle (`subtitleLines`); absent: `second` on one line. */
  secondLines?: readonly string[];
}): {
  width: number;
  height: number;
} {
  const { kind, lines, fontSize, second, secondSize } = input;
  const isHook = kind === "hook_title";
  const seconds = second === null ? [] : (input.secondLines ?? [second]);
  const secondWidth = Math.max(0, ...seconds.map((line) => estimateTextWidth(line, secondSize) + (isHook ? Math.round(secondSize * 1.1) : 0)));
  const lineHeight = isHook ? OVERLAY_LINE_HEIGHT : OVERLAY_TITLE_LINE_HEIGHT;
  // A wrapped subtitle's further lines each add a card line (`OVERLAY_LINE_HEIGHT`), as the render's `<br>` does.
  const secondHeight = seconds.length === 0 ? 0 : secondSize * 1.3 + fontSize * 0.12 + (seconds.length - 1) * secondSize * OVERLAY_LINE_HEIGHT;
  return {
    width: Math.max(secondWidth, input.pin === true ? getPlaceCardPinSize(fontSize) : 0, ...lines.map((line) => estimateTextWidth(line, fontSize))),
    height: lines.length * fontSize * lineHeight + secondHeight + (input.pin === true ? getPlaceCardPinRow(fontSize) : 0),
  };
}

/** A place card's pin height (and width), in px: half its title's size. */
export function getPlaceCardPinSize(fontSize: number): number {
  return Math.round(fontSize * 0.5);
}

/** The row a place card's pin takes above its title: the pin and a small gap. */
export function getPlaceCardPinRow(fontSize: number): number {
  return getPlaceCardPinSize(fontSize) + Math.round(fontSize * 0.1);
}

/** A resolved title's text block inside its card: its left edge and top, in px of the frame. */
export function getTitleContentBox(overlay: TitleOverlay): OverlayBox {
  const second = overlay.kind === "hook_title" ? overlay.place : overlay.subtitle;
  const secondSize = overlay.kind === "hook_title" ? overlay.placeFontSize : overlay.subtitleFontSize;
  const isPlace = overlay.kind === "place_card";
  const size = getTitleContentSize({
    kind: overlay.kind,
    lines: overlay.lines,
    fontSize: overlay.fontSize,
    second,
    secondSize,
    pin: isPlace && overlay.pin !== undefined,
    ...(isPlace && overlay.subtitleLines !== undefined ? { secondLines: overlay.subtitleLines } : {}),
  });
  const { box } = overlay;
  return { left: box.left + (box.width - size.width) / 2, top: box.top + (box.height - size.height) / 2, width: size.width, height: size.height };
}

/** A hook title's or a place card's lines and second line, aligned as its style says. */
function measureTitle(overlay: EdlOverlay & { kind: "hook_title" | "place_card" }, metrics: CardMetrics, isCentred = false): CardResult {
  const { room, label } = metrics;
  const isHook = overlay.kind === "hook_title";
  // In the centred span a place card's title may shrink further, so a card that fitted the whole zone stays on the axis.
  const fitted = fitTitle(overlay.text ?? "", metrics.fontSize, room, MAX_TITLE_SHRINKS + (isCentred && !isHook ? CENTRED_TITLE_EXTRA_SHRINKS : 0));
  if (fitted === null) return { ok: false, error: `the ${label} takes more than ${MAX_OVERLAY_TITLE_LINES} lines even at a smaller size; shorten it or use a smaller size` };
  const { lines, fontSize } = fitted;
  const second = (isHook ? overlay.place : overlay.subtitle) ?? null;
  const subtitle =
    !isHook && second !== null ? fitPlaceSubtitle({ subtitle: second, titleSize: metrics.fontSize, step: overlay.style?.subtitle_size ?? "m", room, scale: metrics.scale, isCentred }) : null;
  if (!isHook && second !== null && subtitle === null) return tooWide(metrics, "subtitle");
  const secondSize = subtitle?.size ?? Math.round(metrics.fontSize * OVERLAY_SECONDARY_SCALE[overlay.kind]);
  const subtitleLines = subtitle !== null && subtitle.lines.length > 1 ? subtitle.lines : undefined;
  // The hook title's place label carries a pin about one label line wide before it.
  const secondWidth = second === null || !isHook ? 0 : estimateTextWidth(second, secondSize) + Math.round(secondSize * 1.1);
  if (secondWidth > room) return tooWide(metrics, "place label");
  // A title's align is center or left (the schema refuses right on it).
  const align: OverlayAlign = overlay.style?.align === "left" ? "left" : "center";
  const pin = !isHook && overlay.style?.pin !== undefined && overlay.style.pin !== "none" ? overlay.style.pin : undefined;
  const delay = !isHook && second !== null && overlay.style?.subtitle_delay !== undefined && overlay.style.subtitle_delay > 0 ? overlay.style.subtitle_delay : undefined;
  return {
    ok: true,
    content: {
      ...getTitleContentSize({ kind: overlay.kind, lines, fontSize, second, secondSize, pin: pin !== undefined, ...(subtitleLines === undefined ? {} : { secondLines: subtitleLines }) }),
      fields: isHook
        ? { kind: "hook_title", lines, place: second, fontSize, placeFontSize: secondSize, align, ...(overlay.style?.backdrop === "highlight" ? { backdrop: "highlight" } : {}) }
        : {
            kind: "place_card",
            lines,
            subtitle: second,
            fontSize,
            subtitleFontSize: secondSize,
            align,
            ...(pin === undefined ? {} : { pin }),
            ...(delay === undefined ? {} : { subtitleDelay: delay }),
            ...(subtitleLines === undefined ? {} : { subtitleLines }),
          },
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
  const pad = getOverlayPadding({ fontSize, padScale: place.padScale });
  const measure = (room: number, isCentred = false): CardResult => {
    const metrics = { fontSize, pad, room: room - 2 * pad.x, label: overlay.kind.replace("_", " "), scale };
    return overlay.kind === "hook_title" || overlay.kind === "place_card"
      ? measureTitle({ ...overlay, kind: overlay.kind }, metrics, isCentred)
      : overlay.kind === "search_bar"
        ? measureSearchBar(overlay, metrics)
        : overlay.kind === "counter"
          ? measureCounter(overlay, metrics)
          : measureDateStamp(overlay, metrics);
  };
  // A date stamp sits on its side of the whole zone; every other card on the frame's axis.
  const measured =
    overlay.kind === "date_stamp"
      ? measure(outer)
      : measureCentred({
          whole: outer,
          centred: getCentredSpan(place, margin).width,
          measure,
          getWidth: (result) => Math.ceil(result.content.width + 2 * pad.x),
          isRetriedWhenRefused: overlay.kind === "place_card",
        });
  if (!measured.ok) return measured;
  const { content } = measured;
  const width = Math.ceil(content.width + 2 * pad.x);
  const height = Math.ceil(content.height + 2 * pad.y);
  const region = getTextRegion(place);
  const top = getPositionTop(region, overlay.style?.position ?? CARD_POSITIONS[overlay.kind], height);
  if (top < region.top || top + height > region.bottom) {
    return { ok: false, error: `the ${overlay.kind.replace("_", " ")} (${height} px tall) does not fit between the platform safe zone and the captions; use a smaller size or shorter text` };
  }
  const left =
    overlay.kind !== "date_stamp" ? getCentredLeft(place, width, margin) : content.fields.side === "right" ? frame.width - zone.right - margin - width : zone.left + margin;
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
    } else if (overlay.kind === "note" && overlay.noteStyle === "strip") {
      // A note card and an end word are drawn in the kit's own handwriting, which covers every Latin letter.
      texts.heading.push(...overlay.lines);
    }
  }
  return texts;
}

/** The texts the overlays draw, every role together. */
export function getOverlayTexts(overlays: readonly ResolvedOverlay[], locale = "en-US"): string[] {
  const texts = getOverlayTextsByRole(overlays, locale);
  return [...texts.heading, ...texts.interface];
}

type NoteOverlay = Extract<ResolvedOverlay, { kind: "note" }>;

/**
 * A note's paper as a polygon in px of the frame, before its tilt: straight sides and a torn edge (`tear`) along the
 * card's foot or the strip's top, cutting at most `NOTE_TEAR_EM` into the paper. Both paths draw this outline.
 */
export function getNotePaperPoints(note: Pick<NoteOverlay, "box" | "fontSize" | "noteStyle" | "tear">): OverlayPoint[] {
  const { left, top, width, height } = note.box;
  const depth = getNotePadding(note.fontSize).tear;
  const last = Math.max(1, note.tear.length - 1);
  const torn = note.tear.map((share, index) => ({ x: r1(left + (width * index) / last), share }));
  if (note.noteStyle === "strip") {
    const edge = torn.map(({ x, share }) => ({ x, y: r1(top + depth * share) }));
    return [...edge, { x: left + width, y: top + height }, { x: left, y: top + height }];
  }
  const edge = torn.map(({ x, share }) => ({ x, y: r1(top + height - depth * share) })).reverse();
  return [{ x: left, y: top }, { x: left + width, y: top }, ...edge];
}

/** The middle of a note's paper: the point its tilt turns it about. */
export function getNoteCentre(note: Pick<NoteOverlay, "box">): OverlayPoint {
  return { x: r1(note.box.left + note.box.width / 2), y: r1(note.box.top + note.box.height / 2) };
}

/** A note's tick as three points of a hand-drawn check (down to the left, then a long stroke up), in px before the tilt. */
export function getNoteTickPoints(note: Pick<NoteOverlay, "box" | "fontSize" | "noteStyle" | "lines">): OverlayPoint[] {
  const text = getNoteTextBox(note);
  const tick = getNoteTickSize(note.fontSize);
  const lastTop = text.top + (note.lines.length - 1) * note.fontSize * NOTE_LINE_HEIGHT;
  const x = text.left + getNoteMeasure(note.noteStyle)(note.lines[note.lines.length - 1] ?? "", note.fontSize) + tick.gap;
  const y = lastTop + (note.fontSize * NOTE_LINE_HEIGHT - tick.size) / 2;
  return [
    { x: r1(x), y: r1(y + tick.size * 0.55) },
    { x: r1(x + tick.size * 0.35), y: r1(y + tick.size * 0.9) },
    { x: r1(x + tick.size), y: r1(y + tick.size * 0.08) },
  ];
}

/** A note's words line by line, each with its film second (a card's `wordTimes`; a strip's are typed, so its start). */
export function getNoteWordsByLine(note: Pick<NoteOverlay, "lines" | "wordTimes" | "start">): { text: string; at: number }[][] {
  let index = 0;
  return note.lines.map((line) =>
    line.split(" ").map((text) => {
      const at = note.wordTimes?.[index] ?? note.start;
      index += 1;
      return { text, at };
    }),
  );
}

/** A note's paper, ink and tick colours: its own (`style.colors` card, text, accent), else paper, near-black and green. */
export function getNoteColors(note: Pick<NoteOverlay, "colors">): { paper: string; ink: string; tick: string } {
  return { paper: note.colors.card ?? NOTE_COLORS.paper, ink: note.colors.text ?? NOTE_COLORS.ink, tick: note.colors.accent ?? NOTE_COLORS.tick };
}

/** Whether the overlays draw in the kit's handwriting: a note card or an end word. */
export function isHandFontNeeded(overlays: readonly ResolvedOverlay[]): boolean {
  return overlays.some((overlay) => overlay.kind === "end_word" || (overlay.kind === "note" && overlay.noteStyle === "card"));
}
