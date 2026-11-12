import { z } from "zod";

import { CORNER_RADII, type CornerRadius } from "./brand-style.js";

/**
 * An EDL's overlays (issue #1200): small graphics and an emphasis zoom placed on a word of the transcript or at a film
 * second, drawn by the render and the draft alike from a fixed catalogue. Their shape lives here so the EDL schema can
 * read them; `overlays.ts` resolves them to film time and places them.
 */

/**
 * `punch_in`: an emphasis zoom of the picture on a word, eased in and back out. `keyword`: one word or number beside
 * the subject. `lower_third`: a place or a name above the captions (or at the top). `list`: 2 to 4 short points.
 * `arrow`: points at `anchor` in the frame. `highlight`: marks the `anchor` rectangle of the frame. `hook_title`: the
 * hook's question or title at the top of the frame, one or two lines, with an optional place label (a drawn pin and
 * "City, Country") above it; it may stay across cuts. `search_bar`: a rounded search field whose text types in.
 * `place_card`: a big place title with a one-line subtitle. `counter`: a number with a unit counting up to its value.
 * `date_stamp`: a day or a date with a place, small, in a corner of the top band. `note`: a paper note (a handwritten
 * card whose words appear as they are said, or a torn strip that grows in and types its text). `end_word`: one big
 * handwritten word at the top over the film's last moment.
 */
export const OVERLAY_KINDS = ["punch_in", "keyword", "lower_third", "list", "arrow", "highlight", "hook_title", "search_bar", "place_card", "counter", "date_stamp", "note", "end_word"] as const;

export type OverlayKind = (typeof OVERLAY_KINDS)[number];

/** An overlay's size step: the zoom of a `punch_in`, the type size of the others. */
export const OVERLAY_SIZES = ["s", "m", "l"] as const;

export type OverlaySize = (typeof OVERLAY_SIZES)[number];

/** The side of the frame a text overlay sits on. */
export const OVERLAY_SIDES = ["left", "right"] as const;

export type OverlaySide = (typeof OVERLAY_SIDES)[number];

/** The band of the text region an overlay sits in (`OVERLAY_POSITIONS_BY_KIND` says which a kind takes). */
export const OVERLAY_POSITIONS = ["top", "middle", "bottom"] as const;

export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

/** How a hook title's or a place card's lines sit in their card: centred (the default) or from its left padding. */
export const OVERLAY_ALIGNS = ["center", "left"] as const;

export type OverlayAlign = (typeof OVERLAY_ALIGNS)[number];

/** Where a keyword's card sits across the room it may take: on the left, in the middle or on the right. */
export const OVERLAY_KEYWORD_ALIGNS = ["left", "center", "right"] as const;

export type OverlayKeywordAlign = (typeof OVERLAY_KEYWORD_ALIGNS)[number];

/** The kinds whose lines take an `align`: the two stacked title cards. */
export const OVERLAY_ALIGNED_KINDS: readonly OverlayKind[] = ["hook_title", "place_card"];

/**
 * How an overlay enters: `fade` in place, `slide` up into place, `type` letter by letter (text kinds), `none` (it is
 * simply there), `pop` (grows from 92 % to 100 % while it fades in, eased out, never past its size), `rise` (up from
 * 5 % of the frame's height while it fades in), `blur` (from a slight blur to sharp) or `wipe` (its card revealed from
 * the left in the accent colour, then its text). Without one, the kind's own entrance. Never a bounce or an overshoot:
 * the reel stays natural (`overlay-motion.ts`). `drop` (a hook title, a keyword, an end word): its letters fall into
 * place one by one, eased out, never below their line.
 */
export const OVERLAY_ENTRANCES = ["fade", "slide", "type", "none", "pop", "rise", "blur", "wipe", "drop"] as const;

export type OverlayEntrance = (typeof OVERLAY_ENTRANCES)[number];

/**
 * How an overlay leaves over its last moment: `auto` mirrors its entrance (a pop shrinks a little as it fades, a rise
 * sinks, a blur blurs, a wipe is wiped off to the right; the kind's own exit without an entrance), `fade`, `slide`
 * (down and out) or `none` (gone at its end).
 */
export const OVERLAY_EXITS = ["auto", "fade", "slide", "none"] as const;

export type OverlayExit = (typeof OVERLAY_EXITS)[number];

/** The curve of an overlay's entrance and exit: `smooth` (the default, a soft ease-out) or `snappy` (quicker, sharper). */
export const OVERLAY_EASINGS = ["smooth", "snappy"] as const;

export type OverlayEasing = (typeof OVERLAY_EASINGS)[number];

/** A place card's pin above its title: `none`, `static` (there with the card) or `drop` (falls a little and stops). */
export const OVERLAY_PINS = ["none", "static", "drop"] as const;

export type OverlayPin = (typeof OVERLAY_PINS)[number];

/**
 * How a list draws its points: `stack` (one centred card, its points one under another, the card growing as each one
 * comes in), `chips` (each point its own small card, side by side in one centred row, entering in turn from the left)
 * or `auto` (chips when every point fits one row at the list's size, else the stack). Without it: `stack`.
 */
export const OVERLAY_LIST_LAYOUTS = ["stack", "chips", "auto"] as const;

export type OverlayListLayout = (typeof OVERLAY_LIST_LAYOUTS)[number];

/**
 * What a hook title's or a keyword's text sits on: `card` (its card, the default) or `highlight` (each line on its own
 * tight box in the card colour, without shadow; typed in, the box grows with the letters).
 */
export const OVERLAY_BACKDROPS = ["card", "highlight"] as const;

export type OverlayBackdrop = (typeof OVERLAY_BACKDROPS)[number];

/** The kinds that take a `backdrop`. */
export const OVERLAY_BACKDROP_KINDS: readonly OverlayKind[] = ["hook_title", "keyword"];

/**
 * A note's shape: `card` (a slightly tilted paper card with a torn foot, its words handwritten as they are said) or
 * `strip` (a paper strip with a torn top that grows in, then types its text in capitals).
 */
export const OVERLAY_NOTE_STYLES = ["card", "strip"] as const;

export type OverlayNoteStyle = (typeof OVERLAY_NOTE_STYLES)[number];

/** The longest a place card's subtitle waits after its title, in seconds. */
export const MAX_OVERLAY_SUBTITLE_DELAY = 0.6;

/** The shortest an overlay stays on screen: shorter does not read. */
export const MIN_OVERLAY_SECONDS = 1;
/** The shortest and longest an `end_word` stays: the film's last moment. */
export const MIN_END_WORD_SECONDS = 0.5;
export const MAX_END_WORD_SECONDS = 2;
/** The longest an overlay stays on screen (a `hook_title` may stay up to `MAX_HOOK_TITLE_SECONDS`). */
export const MAX_OVERLAY_SECONDS = 8;
/** The longest a `hook_title` stays on screen: up to a whole short film. */
export const MAX_HOOK_TITLE_SECONDS = 180;
/** The longest `keyword` text. */
export const MAX_OVERLAY_KEYWORD_LENGTH = 24;
/** The longest `lower_third` text. */
export const MAX_OVERLAY_LOWER_THIRD_LENGTH = 40;
/** The longest point of a `list`. */
export const MAX_OVERLAY_LIST_ITEM_LENGTH = 32;
/** The longest `hook_title` text (one or two lines). */
export const MAX_OVERLAY_HOOK_TITLE_LENGTH = 64;
/** The longest place label (`hook_title`, `date_stamp`). */
export const MAX_OVERLAY_PLACE_LENGTH = 40;
/** The longest `search_bar` query. */
export const MAX_OVERLAY_SEARCH_LENGTH = 40;
/** The longest `place_card` title. */
export const MAX_OVERLAY_PLACE_TITLE_LENGTH = 28;
/** The longest `place_card` subtitle. */
export const MAX_OVERLAY_SUBTITLE_LENGTH = 40;
/** The longest `date_stamp` text. */
export const MAX_OVERLAY_DATE_LENGTH = 24;
/** The longest `note` text. */
export const MAX_OVERLAY_NOTE_LENGTH = 72;
/** The longest `end_word` text. */
export const MAX_OVERLAY_END_WORD_LENGTH = 16;
/** The longest `counter` unit. */
export const MAX_OVERLAY_UNIT_LENGTH = 12;
/** The largest `counter` value. */
export const MAX_OVERLAY_COUNTER_VALUE = 999_999_999;
/** The `type` entrance's and the search bar's typing speed bounds, in characters per second. */
export const MIN_OVERLAY_TYPING_SPEED = 4;
export const MAX_OVERLAY_TYPING_SPEED = 40;
/** The typing speed without a `typing_speed`, in characters per second. */
export const DEFAULT_OVERLAY_TYPING_SPEED = 14;

/** A word of the film's transcript: the `occurrence`-th word (1 first) that reads `text`, compared like fillers are. */
export interface EdlOverlayWord {
  text: string;
  occurrence?: number;
}

/** A point (`arrow`) or a rectangle (`highlight`) of the film's frame, in px from its top left corner. */
export interface EdlOverlayAnchor {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** An overlay's own colours (`#rrggbb`), each one in place of the brand's: its card, its text, its accent. */
export interface EdlOverlayColors {
  card?: string;
  text?: string;
  accent?: string;
}

export interface EdlOverlayStyle {
  size?: OverlaySize;
  side?: OverlaySide;
  position?: OverlayPosition;
  entrance?: OverlayEntrance;
  /** Characters per second of the `type` entrance and the search bar's query. */
  typing_speed?: number;
  colors?: EdlOverlayColors;
  /** Its card's corner in place of the brand style's (`BrandStyle.cornerRadius`); not on a punch_in, arrow or highlight. */
  corner_radius?: CornerRadius;
  /**
   * How a hook title's or a place card's lines sit in the card (`center` or `left`, `center` without it), or where a
   * keyword's card sits across its room (`left`, `center` or `right`, in place of `side`).
   */
  align?: OverlayKeywordAlign;
  /** A place card's subtitle size: `s`, `m` (about 55 % of the title, the default) or `l`. */
  subtitle_size?: OverlaySize;
  /** How it leaves (`auto` without it: mirrors the entrance). */
  exit?: OverlayExit;
  /** The curve of its entrance and exit (`smooth` without it). */
  easing?: OverlayEasing;
  /** A list's points come in one by one (on their `item_words` when given, else spaced automatically). */
  stagger?: boolean;
  /** How a list draws its points (`stack` without it). */
  list_layout?: OverlayListLayout;
  /** Seconds a place card's subtitle waits after its title (0 to `MAX_OVERLAY_SUBTITLE_DELAY`). */
  subtitle_delay?: number;
  /** A place card's accent pin above its title. */
  pin?: OverlayPin;
  /** A keyword's accent bar drawn under the word after it enters. */
  underline?: boolean;
  /** What a hook title's or a keyword's text sits on (`card` without it). */
  backdrop?: OverlayBackdrop;
  /** A note's shape (`card` without it). */
  note_style?: OverlayNoteStyle;
  /** A note's hand-drawn tick after its last word. */
  tick?: boolean;
}

export interface EdlOverlay {
  kind: OverlayKind;
  /** The word it starts on (its start in film time); give this or `at`. */
  at_word?: EdlOverlayWord;
  /** The film second it starts at; give this or `at_word`. */
  at?: number;
  /** Seconds on screen (`MIN_OVERLAY_SECONDS` to `MAX_OVERLAY_SECONDS`; a `hook_title` up to `MAX_HOOK_TITLE_SECONDS`). */
  duration: number;
  /** The text of a `keyword`, `lower_third`, `hook_title`, `search_bar`, `place_card` (its title), `date_stamp`, `note` or `end_word`. */
  text?: string;
  /** The `list` points (2 to 4). */
  items?: string[];
  /** A `list`'s words its points come in on, one per point (they come in one by one); give this or `item_at`. */
  item_words?: EdlOverlayWord[];
  /** A `list`'s film seconds its points come in at, one per point; give this or `item_words`. */
  item_at?: number[];
  /** The `arrow` point or the `highlight` rectangle. */
  anchor?: EdlOverlayAnchor;
  /** The place label of a `hook_title` (with a pin) or a `date_stamp`. */
  place?: string;
  /** The `place_card`'s one-line subtitle. */
  subtitle?: string;
  /** The number a `counter` counts up to, with at most two decimals. */
  value?: number;
  /** The number a `counter` counts from (0 by default), below its `value`. */
  from?: number;
  /** The `counter`'s unit after the number (km, days, a currency). */
  unit?: string;
  style?: EdlOverlayStyle;
}

type FieldRule = "required" | "optional" | "none";

interface KindFields {
  text: FieldRule;
  items: boolean;
  anchor: "none" | "point" | "rect";
  place: boolean;
  subtitle: boolean;
  counter: boolean;
}

const NO_FIELDS: KindFields = { text: "none", items: false, anchor: "none", place: false, subtitle: false, counter: false };
const TEXT_ONLY: KindFields = { ...NO_FIELDS, text: "required" };

/** What each kind needs, takes and refuses. */
const KIND_FIELDS: Record<OverlayKind, KindFields> = {
  punch_in: NO_FIELDS,
  keyword: TEXT_ONLY,
  lower_third: TEXT_ONLY,
  list: { ...NO_FIELDS, items: true },
  arrow: { ...NO_FIELDS, anchor: "point" },
  highlight: { ...NO_FIELDS, anchor: "rect" },
  hook_title: { ...TEXT_ONLY, place: true },
  search_bar: TEXT_ONLY,
  place_card: { ...TEXT_ONLY, subtitle: true },
  counter: { ...NO_FIELDS, counter: true },
  date_stamp: { ...TEXT_ONLY, place: true },
  note: TEXT_ONLY,
  end_word: TEXT_ONLY,
};

const TEXT_LIMITS: Partial<Record<OverlayKind, number>> = {
  keyword: MAX_OVERLAY_KEYWORD_LENGTH,
  lower_third: MAX_OVERLAY_LOWER_THIRD_LENGTH,
  hook_title: MAX_OVERLAY_HOOK_TITLE_LENGTH,
  search_bar: MAX_OVERLAY_SEARCH_LENGTH,
  place_card: MAX_OVERLAY_PLACE_TITLE_LENGTH,
  date_stamp: MAX_OVERLAY_DATE_LENGTH,
  note: MAX_OVERLAY_NOTE_LENGTH,
  end_word: MAX_OVERLAY_END_WORD_LENGTH,
};

/** The kinds that take a side. */
export const OVERLAY_SIDED_KINDS: readonly OverlayKind[] = ["keyword", "lower_third", "list", "date_stamp", "note"];

/** The positions a kind may take (none: its place is fixed). */
export const OVERLAY_POSITIONS_BY_KIND: Partial<Record<OverlayKind, readonly OverlayPosition[]>> = {
  keyword: ["top", "middle", "bottom"],
  lower_third: ["top", "bottom"],
  list: ["top", "middle"],
  search_bar: ["top", "middle", "bottom"],
  place_card: ["top", "middle", "bottom"],
  counter: ["top", "middle", "bottom"],
  note: ["top", "middle"],
};

const TEXT_ENTRANCES: readonly OverlayEntrance[] = ["fade", "slide", "type", "none", "pop", "rise", "blur", "wipe"];
const BLOCK_ENTRANCES: readonly OverlayEntrance[] = ["fade", "slide", "none", "pop", "rise", "blur", "wipe"];

/** The entrances a kind may take (none listed: it takes no entrance). */
export const OVERLAY_ENTRANCES_BY_KIND: Record<OverlayKind, readonly OverlayEntrance[]> = {
  punch_in: [],
  keyword: [...TEXT_ENTRANCES, "drop"],
  lower_third: TEXT_ENTRANCES,
  list: BLOCK_ENTRANCES,
  arrow: ["fade", "none"],
  highlight: ["fade", "none"],
  hook_title: [...TEXT_ENTRANCES, "drop"],
  search_bar: TEXT_ENTRANCES,
  place_card: TEXT_ENTRANCES,
  counter: BLOCK_ENTRANCES,
  date_stamp: TEXT_ENTRANCES,
  note: ["fade", "pop", "none"],
  end_word: ["drop", "pop", "fade", "rise", "none"],
};

/** Whether an overlay types its text in: the `type` entrance, a search bar without another entrance, or a note strip. */
export function isTypedOverlay(overlay: Pick<EdlOverlay, "kind" | "style">): boolean {
  const entrance = overlay.style?.entrance;
  return entrance === "type" || (overlay.kind === "search_bar" && entrance === undefined) || (overlay.kind === "note" && overlay.style?.note_style === "strip");
}

const overlayText = z.string().trim().min(1, "is empty");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "is not a #rrggbb colour");
const article = (kind: OverlayKind): string => (/^[aeiou]/.test(kind) ? `an ${kind}` : `a ${kind}`);
const hasTwoDecimals = (value: number): boolean => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
const counterNumber = z.number().min(0).max(MAX_OVERLAY_COUNTER_VALUE).refine(hasTwoDecimals, "has more than two decimals");

/** Every issue of one overlay's fields against its kind. */
function checkOverlayFields(overlay: EdlOverlay, issue: (path: string[], message: string) => void): void {
  const { kind } = overlay;
  const fields = KIND_FIELDS[kind];
  if ((overlay.at_word === undefined) === (overlay.at === undefined)) issue([], "needs exactly one of at_word and at");
  if (kind === "end_word") {
    // Below MIN_END_WORD_SECONDS the field's own minimum refuses it.
    if (overlay.duration > MAX_END_WORD_SECONDS) issue(["duration"], `an end_word stays ${MIN_END_WORD_SECONDS} to ${MAX_END_WORD_SECONDS} s`);
  } else if (overlay.duration < MIN_OVERLAY_SECONDS) issue(["duration"], `${article(kind)} stays at least ${MIN_OVERLAY_SECONDS} s (only an end_word stays shorter)`);
  else if (kind !== "hook_title" && overlay.duration > MAX_OVERLAY_SECONDS) issue(["duration"], `${article(kind)} stays at most ${MAX_OVERLAY_SECONDS} s (only a hook_title stays longer)`);
  if (fields.text === "required" && overlay.text === undefined) issue(["text"], `${article(kind)} needs its text`);
  if (fields.text === "none" && overlay.text !== undefined) issue(["text"], `${article(kind)} draws no text; leave it out`);
  const limit = TEXT_LIMITS[kind];
  if (limit !== undefined && overlay.text !== undefined && overlay.text.length > limit) issue(["text"], `is longer than ${limit} characters`);
  if (fields.items && overlay.items === undefined) issue(["items"], "a list needs 2 to 4 points");
  if (overlay.item_words !== undefined) {
    if (kind !== "list") issue(["item_words"], `${article(kind)} has no points; leave item_words out`);
    else if (overlay.items !== undefined && overlay.item_words.length !== overlay.items.length) issue(["item_words"], `gives ${overlay.item_words.length} words for ${overlay.items.length} points; one word per point`);
  }
  if (overlay.item_at !== undefined) {
    if (kind !== "list") issue(["item_at"], `${article(kind)} has no points; leave item_at out`);
    else if (overlay.item_words !== undefined) issue(["item_at"], "give item_words or item_at, not both");
    else if (overlay.items !== undefined && overlay.item_at.length !== overlay.items.length) issue(["item_at"], `gives ${overlay.item_at.length} seconds for ${overlay.items.length} points; one second per point`);
  }
  if (!fields.items && overlay.items !== undefined) issue(["items"], `${article(kind)} draws no points; leave them out`);
  if (fields.anchor === "none" && overlay.anchor !== undefined) issue(["anchor"], `${article(kind)} has no anchor; leave it out`);
  if (fields.anchor !== "none" && overlay.anchor === undefined) issue(["anchor"], `${article(kind)} needs its anchor`);
  const isRect = overlay.anchor?.width !== undefined && overlay.anchor.height !== undefined;
  if (fields.anchor === "rect" && overlay.anchor !== undefined && !isRect) issue(["anchor"], "a highlight needs the anchor's width and height");
  if (fields.anchor === "point" && (overlay.anchor?.width !== undefined || overlay.anchor?.height !== undefined)) issue(["anchor"], "an arrow points at a point: leave width and height out");
  if (!fields.place && overlay.place !== undefined) issue(["place"], `${article(kind)} has no place label; leave it out`);
  if (!fields.subtitle && overlay.subtitle !== undefined) issue(["subtitle"], `${article(kind)} has no subtitle; leave it out`);
  if (fields.counter && overlay.value === undefined) issue(["value"], "a counter needs its value");
  if (!fields.counter) {
    for (const key of ["value", "from", "unit"] as const) if (overlay[key] !== undefined) issue([key], `${article(kind)} counts nothing; leave ${key} out`);
  }
  if (overlay.value !== undefined && overlay.from !== undefined && overlay.from >= overlay.value) issue(["from"], "a counter counts up: from must be below value");
}

/** Every issue of one overlay's style knobs against its kind. */
function checkOverlayStyle(overlay: EdlOverlay, issue: (path: string[], message: string) => void): void {
  const { kind, style } = overlay;
  if (style === undefined) return;
  if (style.side !== undefined && !OVERLAY_SIDED_KINDS.includes(kind)) issue(["style", "side"], `${article(kind)} has no side; leave it out`);
  const positions = OVERLAY_POSITIONS_BY_KIND[kind];
  if (style.position !== undefined && !(positions ?? []).includes(style.position)) {
    issue(["style", "position"], positions === undefined ? `${article(kind)} has a fixed place; leave position out` : `${article(kind)} sits at ${positions.join(", ")}`);
  }
  const entrances = OVERLAY_ENTRANCES_BY_KIND[kind];
  if (style.entrance !== undefined && !entrances.includes(style.entrance)) {
    issue(["style", "entrance"], entrances.length === 0 ? `${article(kind)} has no entrance; leave it out` : `${article(kind)} enters by ${entrances.join(", ")}`);
  }
  if (style.typing_speed !== undefined && !isTypedOverlay(overlay)) issue(["style", "typing_speed"], "only a typed entrance, a search bar or a note strip has a typing speed");
  if (style.corner_radius !== undefined && (kind === "punch_in" || kind === "arrow" || kind === "highlight")) issue(["style", "corner_radius"], `${article(kind)} draws no card; leave corner_radius out`);
  if (style.align !== undefined) {
    if (kind === "keyword") {
      if (style.side !== undefined) issue(["style", "align"], "give a keyword align or side, not both");
    } else if (!OVERLAY_ALIGNED_KINDS.includes(kind)) issue(["style", "align"], "only a hook_title, a place_card or a keyword takes align; leave it out");
    else if (!(OVERLAY_ALIGNS as readonly string[]).includes(style.align)) issue(["style", "align"], `${article(kind)} aligns its lines ${OVERLAY_ALIGNS.join(" or ")}`);
  }
  if (style.subtitle_size !== undefined && kind !== "place_card") issue(["style", "subtitle_size"], "only a place_card has a subtitle; leave subtitle_size out");
  if (style.subtitle_delay !== undefined && kind !== "place_card") issue(["style", "subtitle_delay"], "only a place_card has a subtitle; leave subtitle_delay out");
  if (style.pin !== undefined && kind !== "place_card") issue(["style", "pin"], "only a place_card draws a pin; leave pin out");
  if (style.stagger !== undefined && kind !== "list") issue(["style", "stagger"], "only a list has points to stagger; leave stagger out");
  if (style.list_layout !== undefined && kind !== "list") issue(["style", "list_layout"], "only a list lays out points; leave list_layout out");
  if (style.underline !== undefined && kind !== "keyword") issue(["style", "underline"], "only a keyword is underlined; leave underline out");
  if (style.backdrop !== undefined && !OVERLAY_BACKDROP_KINDS.includes(kind)) issue(["style", "backdrop"], "only a hook_title or a keyword takes a backdrop; leave it out");
  if (style.backdrop === "highlight" && style.underline === true) issue(["style", "backdrop"], "a highlighted keyword draws no underline; give backdrop highlight or underline, not both");
  if (style.note_style !== undefined && kind !== "note") issue(["style", "note_style"], "only a note has a note_style; leave it out");
  if (style.tick !== undefined && kind !== "note") issue(["style", "tick"], "only a note draws a tick; leave it out");
  if ((style.exit !== undefined || style.easing !== undefined) && kind === "punch_in") issue(["style", style.exit === undefined ? "easing" : "exit"], "a punch_in eases the picture itself; leave exit and easing out");
  if (style.colors === undefined) return;
  if (kind === "punch_in") issue(["style", "colors"], "a punch_in draws nothing to colour; leave colors out");
  if ((kind === "arrow" || kind === "highlight") && (style.colors.card !== undefined || style.colors.text !== undefined)) {
    issue(["style", "colors"], `${article(kind)} draws in its accent only; leave card and text out`);
  }
}

export const overlaySchema = z
  .strictObject({
    kind: z
      .enum(OVERLAY_KINDS)
      .describe("punch_in (an emphasis zoom on a word), keyword, lower_third, list, arrow, highlight, hook_title, search_bar, place_card, counter, date_stamp, note or end_word."),
    at_word: z
      .strictObject({
        text: overlayText.describe("The word as the transcript has it; compared without case and punctuation."),
        occurrence: z.number().int().min(1).optional().describe("Which time the film says it (1 the first, the default)."),
      })
      .optional()
      .describe("The transcript word the overlay starts on (its start after the cut); give this or at."),
    at: z.number().min(0).optional().describe("The film second the overlay starts at; give this or at_word."),
    duration: z
      .number()
      .min(MIN_END_WORD_SECONDS)
      .max(MAX_HOOK_TITLE_SECONDS)
      .describe(`Seconds on screen (${MIN_OVERLAY_SECONDS}-${MAX_OVERLAY_SECONDS}; a hook_title up to ${MAX_HOOK_TITLE_SECONDS}; an end_word ${MIN_END_WORD_SECONDS}-${MAX_END_WORD_SECONDS}).`),
    text: overlayText
      .optional()
      .describe(
        `The text: keyword (up to ${MAX_OVERLAY_KEYWORD_LENGTH} characters), lower_third (${MAX_OVERLAY_LOWER_THIRD_LENGTH}), hook_title (${MAX_OVERLAY_HOOK_TITLE_LENGTH}, one or two lines), search_bar (${MAX_OVERLAY_SEARCH_LENGTH}), place_card title (${MAX_OVERLAY_PLACE_TITLE_LENGTH}), date_stamp (${MAX_OVERLAY_DATE_LENGTH}), note (${MAX_OVERLAY_NOTE_LENGTH}) or end_word (${MAX_OVERLAY_END_WORD_LENGTH}, one line).`,
      ),
    items: z
      .array(overlayText.max(MAX_OVERLAY_LIST_ITEM_LENGTH, `is longer than ${MAX_OVERLAY_LIST_ITEM_LENGTH} characters`))
      .min(2, "a list needs 2 to 4 points")
      .max(4, "a list needs 2 to 4 points")
      .optional()
      .describe(`The list's points: 2 to 4, up to ${MAX_OVERLAY_LIST_ITEM_LENGTH} characters each.`),
    item_words: z
      .array(
        z.strictObject({
          text: overlayText.describe("The word as the transcript has it; compared without case and punctuation."),
          occurrence: z.number().int().min(1).optional().describe("Which time the film says it (1 the first, the default)."),
        }),
      )
      .min(2)
      .max(4)
      .optional()
      .describe("A list only: the word each point comes in on, one per point in order; the points come in one by one."),
    item_at: z
      .array(z.number().min(0))
      .min(2)
      .max(4)
      .optional()
      .describe("A list only, in place of item_words: the film second each point comes in at, one per point in order."),
    anchor: z
      .strictObject({
        x: z.number().min(0).describe("Px from the frame's left edge."),
        y: z.number().min(0).describe("Px from the frame's top edge."),
        width: z.number().positive().optional().describe("The highlight's width in px."),
        height: z.number().positive().optional().describe("The highlight's height in px."),
      })
      .optional()
      .describe("The point an arrow points at, or the rectangle a highlight marks (x, y its top left), in px of the film's frame."),
    place: overlayText
      .max(MAX_OVERLAY_PLACE_LENGTH, `is longer than ${MAX_OVERLAY_PLACE_LENGTH} characters`)
      .optional()
      .describe(`A hook_title's place label above it (drawn with a pin) or a date_stamp's place, e.g. "Hanoi, Vietnam" (up to ${MAX_OVERLAY_PLACE_LENGTH} characters).`),
    subtitle: overlayText
      .max(MAX_OVERLAY_SUBTITLE_LENGTH, `is longer than ${MAX_OVERLAY_SUBTITLE_LENGTH} characters`)
      .optional()
      .describe(`A place_card's one-line subtitle (up to ${MAX_OVERLAY_SUBTITLE_LENGTH} characters).`),
    value: counterNumber.optional().describe("The number a counter counts up to (at most two decimals)."),
    from: counterNumber.optional().describe("The number a counter counts from (0 by default), below its value."),
    unit: overlayText
      .max(MAX_OVERLAY_UNIT_LENGTH, `is longer than ${MAX_OVERLAY_UNIT_LENGTH} characters`)
      .optional()
      .describe(`A counter's unit after the number, e.g. km (up to ${MAX_OVERLAY_UNIT_LENGTH} characters).`),
    style: z
      .strictObject({
        size: z.enum(OVERLAY_SIZES).optional().describe("s, m (the default) or l: the punch-in's zoom (108, 112, 115 %) or the type size."),
        side: z.enum(OVERLAY_SIDES).optional().describe("The side a keyword, lower third, list, date stamp or note sits on."),
        position: z
          .enum(OVERLAY_POSITIONS)
          .optional()
          .describe("top, middle or bottom of the room above the captions: keyword, search_bar, place_card, counter (any), lower_third (top or bottom), list and note (top or middle)."),
        entrance: z
          .enum(OVERLAY_ENTRANCES)
          .optional()
          .describe(
            "fade, slide, type (text typed in letter by letter), none, pop (92 % to 100 %, no overshoot), rise (up from 5 % of the height), blur (blurred to sharp), wipe (card revealed from the left in the accent, then the text) or drop (hook_title, keyword, end_word: letters fall into place one by one, never below their line); without it the kind's own. Never a bounce.",
          ),
        exit: z.enum(OVERLAY_EXITS).optional().describe("auto (the default: mirrors the entrance), fade, slide (down and out) or none."),
        easing: z.enum(OVERLAY_EASINGS).optional().describe("smooth (the default) or snappy: the curve of the entrance and the exit."),
        typing_speed: z
          .number()
          .min(MIN_OVERLAY_TYPING_SPEED)
          .max(MAX_OVERLAY_TYPING_SPEED)
          .optional()
          .describe(`Characters per second of a typed entrance or a search bar (${MIN_OVERLAY_TYPING_SPEED}-${MAX_OVERLAY_TYPING_SPEED}, ${DEFAULT_OVERLAY_TYPING_SPEED} by default).`),
        colors: z
          .strictObject({
            card: hexColor.optional().describe("The card's colour (#rrggbb); the brand's background without it."),
            text: hexColor.optional().describe("The text's colour; the brand's foreground without it."),
            accent: hexColor.optional().describe("The accent (dot, pin, magnifier, arrow, marker); the brand's accent without it."),
          })
          .optional()
          .describe("The overlay's own colours in place of the brand's."),
        corner_radius: z
          .enum(CORNER_RADII)
          .optional()
          .describe("The card's corner: none, s, m, l or pill; the brand style's without it (no punch_in, arrow or highlight)."),
        align: z
          .enum(OVERLAY_KEYWORD_ALIGNS)
          .optional()
          .describe(
            "center (the default) or left: how a hook_title's or a place_card's lines sit in their card; left, center or right: where a keyword's card sits across its room (in place of side).",
          ),
        subtitle_size: z.enum(OVERLAY_SIZES).optional().describe("s, m (the default, about 55 % of the title) or l: a place_card's subtitle size."),
        stagger: z.boolean().optional().describe("A list only: its points come in one by one (on item_words when given, else spaced automatically)."),
        list_layout: z
          .enum(OVERLAY_LIST_LAYOUTS)
          .optional()
          .describe(
            "A list only: stack (the default: one centred card growing as each point comes in), chips (each point its own small card in one centred row, entering in turn from the left) or auto (chips when they fit one row, else stack).",
          ),
        subtitle_delay: z
          .number()
          .min(0)
          .max(MAX_OVERLAY_SUBTITLE_DELAY)
          .optional()
          .describe(`A place_card only: seconds its subtitle waits after its title (0-${MAX_OVERLAY_SUBTITLE_DELAY}).`),
        pin: z.enum(OVERLAY_PINS).optional().describe("A place_card only: none (the default), static or drop (an accent pin above the title that falls a little and stops)."),
        underline: z.boolean().optional().describe("A keyword only: an accent bar drawn under the word after it enters."),
        backdrop: z
          .enum(OVERLAY_BACKDROPS)
          .optional()
          .describe("A hook_title or keyword only: card (the default) or highlight (each line on its own tight box in the card colour; typed in, the box grows with the letters)."),
        note_style: z
          .enum(OVERLAY_NOTE_STYLES)
          .optional()
          .describe("A note only: card (the default: a tilted paper card, handwritten words appearing as they are said) or strip (a torn paper strip that grows in, then types its text in capitals)."),
        tick: z.boolean().optional().describe("A note only: a hand-drawn tick after its last word."),
      })
      .optional()
      .describe("The overlay's look: size, side, position, entrance, typing speed and colours; fonts are the brand's."),
  })
  .superRefine((overlay, context) => {
    const issue = (path: string[], message: string) => context.addIssue({ code: "custom", path, message });
    checkOverlayFields(overlay, issue);
    checkOverlayStyle(overlay, issue);
  });
