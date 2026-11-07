import { z } from "zod";

/**
 * An EDL's overlays (issue #1200): small graphics and an emphasis zoom placed on a word of the transcript or at a film
 * second, drawn by the render and the draft alike from a fixed catalogue. Their shape lives here so the EDL schema can
 * read them; `overlays.ts` resolves them to film time and places them.
 */

/**
 * `punch_in`: an emphasis zoom of the picture on a word, eased in and back out. `keyword`: one word or number beside
 * the subject. `lower_third`: a place or a name above the captions. `list`: 2 to 4 short points. `arrow`: points at
 * `anchor` in the frame. `highlight`: marks the `anchor` rectangle of the frame.
 */
export const OVERLAY_KINDS = ["punch_in", "keyword", "lower_third", "list", "arrow", "highlight"] as const;

export type OverlayKind = (typeof OVERLAY_KINDS)[number];

/** An overlay's size step: the zoom of a `punch_in`, the type size of the others. */
export const OVERLAY_SIZES = ["s", "m", "l"] as const;

export type OverlaySize = (typeof OVERLAY_SIZES)[number];

/** The side of the frame a text overlay sits on. */
export const OVERLAY_SIDES = ["left", "right"] as const;

export type OverlaySide = (typeof OVERLAY_SIDES)[number];

/** The shortest an overlay stays on screen: shorter does not read. */
export const MIN_OVERLAY_SECONDS = 1;
/** The longest an overlay stays on screen. */
export const MAX_OVERLAY_SECONDS = 8;
/** The longest `keyword` text. */
export const MAX_OVERLAY_KEYWORD_LENGTH = 24;
/** The longest `lower_third` text. */
export const MAX_OVERLAY_LOWER_THIRD_LENGTH = 40;
/** The longest point of a `list`. */
export const MAX_OVERLAY_LIST_ITEM_LENGTH = 32;

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

export interface EdlOverlayStyle {
  size?: OverlaySize;
  side?: OverlaySide;
}

export interface EdlOverlay {
  kind: OverlayKind;
  /** The word it starts on (its start in film time); give this or `at`. */
  at_word?: EdlOverlayWord;
  /** The film second it starts at; give this or `at_word`. */
  at?: number;
  /** Seconds on screen (`MIN_OVERLAY_SECONDS` to `MAX_OVERLAY_SECONDS`). */
  duration: number;
  /** The `keyword` or the `lower_third` text. */
  text?: string;
  /** The `list` points (2 to 4). */
  items?: string[];
  /** The `arrow` point or the `highlight` rectangle. */
  anchor?: EdlOverlayAnchor;
  style?: EdlOverlayStyle;
}

/** What each kind needs and refuses: its text, its points or its anchor. */
const KIND_FIELDS: Record<OverlayKind, { text: boolean; items: boolean; anchor: "none" | "point" | "rect" }> = {
  punch_in: { text: false, items: false, anchor: "none" },
  keyword: { text: true, items: false, anchor: "none" },
  lower_third: { text: true, items: false, anchor: "none" },
  list: { text: false, items: true, anchor: "none" },
  arrow: { text: false, items: false, anchor: "point" },
  highlight: { text: false, items: false, anchor: "rect" },
};

const TEXT_LIMITS: Partial<Record<OverlayKind, number>> = { keyword: MAX_OVERLAY_KEYWORD_LENGTH, lower_third: MAX_OVERLAY_LOWER_THIRD_LENGTH };

const overlayText = z.string().trim().min(1, "is empty");

export const overlaySchema = z
  .strictObject({
    kind: z.enum(OVERLAY_KINDS).describe("punch_in (an emphasis zoom on a word), keyword, lower_third, list, arrow or highlight."),
    at_word: z
      .strictObject({
        text: overlayText.describe("The word as the transcript has it; compared without case and punctuation."),
        occurrence: z.number().int().min(1).optional().describe("Which time the film says it (1 the first, the default)."),
      })
      .optional()
      .describe("The transcript word the overlay starts on (its start after the cut); give this or at."),
    at: z.number().min(0).optional().describe("The film second the overlay starts at; give this or at_word."),
    duration: z.number().min(MIN_OVERLAY_SECONDS).max(MAX_OVERLAY_SECONDS).describe(`Seconds on screen (${MIN_OVERLAY_SECONDS}-${MAX_OVERLAY_SECONDS}).`),
    text: overlayText.optional().describe(`The keyword (up to ${MAX_OVERLAY_KEYWORD_LENGTH} characters) or the lower third (up to ${MAX_OVERLAY_LOWER_THIRD_LENGTH}).`),
    items: z
      .array(overlayText.max(MAX_OVERLAY_LIST_ITEM_LENGTH, `is longer than ${MAX_OVERLAY_LIST_ITEM_LENGTH} characters`))
      .min(2, "a list needs 2 to 4 points")
      .max(4, "a list needs 2 to 4 points")
      .optional()
      .describe(`The list's points: 2 to 4, up to ${MAX_OVERLAY_LIST_ITEM_LENGTH} characters each.`),
    anchor: z
      .strictObject({
        x: z.number().min(0).describe("Px from the frame's left edge."),
        y: z.number().min(0).describe("Px from the frame's top edge."),
        width: z.number().positive().optional().describe("The highlight's width in px."),
        height: z.number().positive().optional().describe("The highlight's height in px."),
      })
      .optional()
      .describe("The point an arrow points at, or the rectangle a highlight marks (x, y its top left), in px of the film's frame."),
    style: z
      .strictObject({
        size: z.enum(OVERLAY_SIZES).optional().describe("s, m (the default) or l: the punch-in's zoom (108, 112, 115 %) or the type size."),
        side: z.enum(OVERLAY_SIDES).optional().describe("The side a keyword, lower third or list sits on."),
      })
      .optional()
      .describe("The overlay's size step and side; colours and fonts are the brand's."),
  })
  .superRefine((overlay, context) => {
    const fields = KIND_FIELDS[overlay.kind];
    if ((overlay.at_word === undefined) === (overlay.at === undefined)) context.addIssue({ code: "custom", path: [], message: "needs exactly one of at_word and at" });
    if (fields.text && overlay.text === undefined) context.addIssue({ code: "custom", path: ["text"], message: `a ${overlay.kind} needs its text` });
    if (!fields.text && overlay.text !== undefined) context.addIssue({ code: "custom", path: ["text"], message: `a ${overlay.kind} draws no text; leave it out` });
    const limit = TEXT_LIMITS[overlay.kind];
    if (limit !== undefined && overlay.text !== undefined && overlay.text.length > limit) {
      context.addIssue({ code: "custom", path: ["text"], message: `is longer than ${limit} characters` });
    }
    if (fields.items && overlay.items === undefined) context.addIssue({ code: "custom", path: ["items"], message: "a list needs 2 to 4 points" });
    if (!fields.items && overlay.items !== undefined) context.addIssue({ code: "custom", path: ["items"], message: `a ${overlay.kind} draws no points; leave them out` });
    if (fields.anchor === "none" && overlay.anchor !== undefined) context.addIssue({ code: "custom", path: ["anchor"], message: `a ${overlay.kind} has no anchor; leave it out` });
    if (fields.anchor !== "none" && overlay.anchor === undefined) context.addIssue({ code: "custom", path: ["anchor"], message: `${overlay.kind === "arrow" ? "an arrow" : "a highlight"} needs its anchor` });
    const isRect = overlay.anchor?.width !== undefined && overlay.anchor.height !== undefined;
    if (fields.anchor === "rect" && overlay.anchor !== undefined && !isRect) context.addIssue({ code: "custom", path: ["anchor"], message: "a highlight needs the anchor's width and height" });
    if (fields.anchor === "point" && (overlay.anchor?.width !== undefined || overlay.anchor?.height !== undefined)) {
      context.addIssue({ code: "custom", path: ["anchor"], message: "an arrow points at a point: leave width and height out" });
    }
    if (overlay.kind !== "keyword" && overlay.kind !== "lower_third" && overlay.kind !== "list" && overlay.style?.side !== undefined) {
      context.addIssue({ code: "custom", path: ["style", "side"], message: `a ${overlay.kind} has no side; leave it out` });
    }
  });
