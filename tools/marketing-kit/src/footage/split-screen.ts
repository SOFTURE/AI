import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { z } from "zod";

import { HAND_FONT, measureHandText } from "./hand-font.js";
import { FOOTAGE_FPS, type Frame } from "./normalize.js";

/**
 * A split screen: a segment's picture made of three shots stacked in horizontal bands, as reels compare three places.
 * Each band plays its own clip from its own second for the segment's length, cropped to the band (a `focus` picks how
 * high), and carries a short handwritten label with a drawn curved arrow pointing into it. The segment's sound stays
 * its own (`clip`, or `audio`).
 *
 * The draft (`draft.ts`) and the render's picture (`picture.ts`) build the bands with one filter builder
 * (`buildSplitScreenFilters`) and lay the same layer over them: the labels, the arrows and the thin lines between the
 * bands drawn once as an SVG (`getSplitLayerSvg`) and rasterised by resvg at the path's frame size
 * (`renderSplitLayerPng`), so both paths show the same picture. The handwriting is the kit's own hand font (Caveat,
 * OFL); the arrows are curves made in code.
 *
 * The labels zig-zag: the top band's sits low on the left with its arrow rising into the shot, the middle band's high
 * on the right, the bottom band's high on the left with arrows falling into theirs. That keeps the frame's top (the
 * platform's header) and its foot (the platform's buttons) clear and leaves the lower half of the middle band free for
 * the captions (`getSplitCaption`, `findSplitCaptionProblems`).
 */

export const SPLIT_LAYOUTS = ["split3"] as const;

export type SplitLayout = (typeof SPLIT_LAYOUTS)[number];

/** How many bands a `split3` has. */
export const SPLIT_BANDS = 3;

/** The longest label, in characters; a label must also fit its width (`MAX_LABEL_WIDTH_SHARE` of the frame). */
export const MAX_SPLIT_LABEL_CHARACTERS = 24;

/** A label's handwriting size, in px of a 1080 px wide frame. */
const LABEL_SIZE = 60;
/** The widest a label may be, as a share of the frame's width (the arrow needs the rest). */
const MAX_LABEL_WIDTH_SHARE = 0.5;
/** A label's distance from the frame's side, in px of a 1080 px wide frame. */
const LABEL_SIDE = 64;
/** The arrow's stroke and its head's strokes, in px of a 1080 px wide frame. */
const ARROW_STROKE = 6;
const ARROW_HEAD = 30;
/** The line between two bands, in px of a 1080 px wide frame. */
const BAND_LINE = 4;
/** How far a label's shadow falls and blurs, in px of a 1080 px wide frame. */
const SHADOW_OFFSET = 3;
const SHADOW_BLUR = 4;

/** One band of a split screen: its clip, the second it starts from, its label, and how high the crop sits. */
export interface EdlSplitBand {
  clip: string;
  /** Seconds in the trimmed clip where the band's shot starts; it plays for the segment's length. */
  start: number;
  /** A short handwritten label (one line, at most `MAX_SPLIT_LABEL_CHARACTERS`). */
  label: string;
  /** Where the band's crop sits in the shot's height, 0 (its top) to 1 (its foot); absent: 0.5, the middle. */
  focus?: number;
}

/** A segment's split screen (`EdlSegment.split`). */
export interface EdlSplit {
  layout: SplitLayout;
  bands: [EdlSplitBand, EdlSplitBand, EdlSplitBand];
}

const bandSchema = z.strictObject({
  clip: z.string().min(1).describe("The band's clip id."),
  start: z.number().min(0).describe("Seconds in that trimmed clip where the band's shot starts; it plays for the segment's length."),
  label: z
    .string()
    .trim()
    .min(1, "a band needs a label")
    .max(MAX_SPLIT_LABEL_CHARACTERS, `a label is at most ${String(MAX_SPLIT_LABEL_CHARACTERS)} characters`)
    .regex(/^[^\n\r]*$/, "a label is one line")
    .describe(`A short handwritten label, one line, at most ${String(MAX_SPLIT_LABEL_CHARACTERS)} characters (a place's name).`),
  focus: z.number().min(0).max(1).optional().describe("Where the band's crop sits in the shot's height: 0 its top, 1 its foot; 0.5 (the middle) without it."),
});

export const splitSchema = z
  .strictObject({
    layout: z.enum(SPLIT_LAYOUTS).describe("split3: three shots stacked in horizontal bands."),
    bands: z.tuple([bandSchema, bandSchema, bandSchema]).describe("The three bands, top to bottom."),
  })
  .describe(
    "A split screen: the segment's picture is three shots stacked in bands, each with a handwritten label and a drawn arrow; the segment's sound stays its own. Still (no camera, Ken Burns, zoom or stutter), not the cut's last segment, and the segment after it starts on a plain cut.",
  );

/** A rectangle of the frame, in px. */
export interface SplitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where one band sits and where its label and arrow go, in px of the frame. */
export interface SplitBandPlace {
  /** The band's rectangle (full width). */
  band: SplitBox;
  /** The label's side: its text starts at `x` (left) or ends at it (right). */
  side: "left" | "right";
  /** The label's baseline. */
  labelX: number;
  labelY: number;
  /** Where the arrow points, in the band's shot. */
  arrowTo: { x: number; y: number };
  /** The stretch of the frame's height the label and its arrow take (captions keep off it). */
  reserved: { top: number; bottom: number };
}

const round = (value: number): number => Math.round(value);

/** An even size of at least 2 px, as yuv420p needs. */
function toEven(value: number): number {
  return Math.max(2, 2 * Math.floor(value / 2));
}

/** The three bands' heights: equal and even, the last one taking what rounding leaves. */
export function getSplitBandHeights(frame: Frame): [number, number, number] {
  const band = toEven(frame.height / SPLIT_BANDS);
  return [band, band, frame.height - 2 * band];
}

/**
 * Each band's rectangle, label place and arrow target. The top band's label sits at 78 % of its height on the left,
 * its arrow rising to the shot's middle; the middle band's at 24 % on the right and the bottom band's at 22 % on the
 * left, their arrows falling into the shot.
 */
export function getSplitPlaces(frame: Frame): [SplitBandPlace, SplitBandPlace, SplitBandPlace] {
  const scale = frame.width / 1080;
  const heights = getSplitBandHeights(frame);
  const tops = [0, heights[0], heights[0] + heights[1]];
  const side = round(LABEL_SIDE * scale);
  const label = LABEL_SIZE * scale;
  const place = (index: 0 | 1 | 2): SplitBandPlace => {
    const top = tops[index] as number;
    const height = heights[index];
    const band = { x: 0, y: top, width: frame.width, height };
    if (index === 0) {
      const labelY = round(top + 0.78 * height);
      const arrowTo = { x: round(0.56 * frame.width), y: round(top + 0.42 * height) };
      return { band, side: "left", labelX: side, labelY, arrowTo, reserved: { top: arrowTo.y, bottom: round(labelY + 0.35 * label) } };
    }
    const labelY = round(top + (index === 1 ? 0.24 : 0.22) * height);
    const arrowTo = { x: round((index === 1 ? 0.42 : 0.58) * frame.width), y: round(top + (index === 1 ? 0.46 : 0.42) * height) };
    return { band, side: index === 1 ? "right" : "left", labelX: index === 1 ? frame.width - side : side, labelY, arrowTo, reserved: { top: round(labelY - label), bottom: arrowTo.y } };
  };
  return [place(0), place(1), place(2)];
}

/** How wide `label` is written, in px of the frame. */
function measureLabel(label: string, frame: Frame): number {
  return measureHandText(label, LABEL_SIZE * (frame.width / 1080));
}

/** What makes a split's labels unusable in this frame: a label too wide for its band (empty when they all fit). */
export function findSplitLabelProblems(split: EdlSplit, frame: Frame, at: string): string[] {
  const limit = round(frame.width * MAX_LABEL_WIDTH_SHARE);
  return split.bands.flatMap((band, index) => {
    const width = measureLabel(band.label, frame);
    return width > limit ? [`${at}.bands[${String(index)}].label: "${band.label}" is ${String(width)} px wide, more than ${String(limit)} px; shorten it`] : [];
  });
}

const f1 = (value: number): string => String(Math.round(value * 10) / 10);

/**
 * The arrow from the label's end to the band's shot: a curve bowed to one side, slightly uneven like a hand's stroke,
 * and its head's two strokes along the curve's last direction.
 */
export function getSplitArrowPaths(from: { x: number; y: number }, to: { x: number; y: number }, scale: number): { curve: string; head: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // A normal that bows the curve away from the frame's centre line, a third of the way and two thirds unevenly.
  const nx = -dy / length;
  const ny = dx / length;
  const bow = length * 0.22;
  const c1 = { x: from.x + dx * 0.3 + nx * bow, y: from.y + dy * 0.3 + ny * bow };
  const c2 = { x: from.x + dx * 0.72 + nx * bow * 0.8, y: from.y + dy * 0.72 + ny * bow * 0.8 };
  const tx = to.x - c2.x;
  const ty = to.y - c2.y;
  const angle = Math.atan2(ty, tx);
  const head = ARROW_HEAD * scale;
  const wing = (turn: number): string => `M${f1(to.x - head * Math.cos(angle + turn))} ${f1(to.y - head * Math.sin(angle + turn))} L${f1(to.x)} ${f1(to.y)}`;
  return {
    curve: `M${f1(from.x)} ${f1(from.y)} C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(to.x)} ${f1(to.y)}`,
    head: `${wing(0.5)} ${wing(-0.45)}`,
  };
}

const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The layer over the bands, as an SVG of the frame's size: the lines between the bands, each label and its arrow. */
export function getSplitLayerSvg(split: EdlSplit, frame: Frame): string {
  const scale = frame.width / 1080;
  const places = getSplitPlaces(frame);
  const line = BAND_LINE * scale;
  const size = LABEL_SIZE * scale;
  const gap = 18 * scale;
  const parts: string[] = [];
  for (const place of places.slice(1)) {
    parts.push(`<rect x="0" y="${f1(place.band.y - line / 2)}" width="${String(frame.width)}" height="${f1(line)}" fill="#111111"/>`);
  }
  split.bands.forEach((band, index) => {
    const place = places[index] as SplitBandPlace;
    const width = measureLabel(band.label, frame);
    const isLeft = place.side === "left";
    // The arrow starts beside the label's end, at its x-height, and points into the shot.
    const from = { x: isLeft ? place.labelX + width + gap : place.labelX - width - gap, y: place.labelY - (index === 0 ? size * 0.55 : size * 0.2) };
    const arrow = getSplitArrowPaths(from, place.arrowTo, scale);
    parts.push(
      `<g filter="url(#shadow)">`,
      `<text x="${f1(place.labelX)}" y="${f1(place.labelY)}" text-anchor="${isLeft ? "start" : "end"}" font-family="${HAND_FONT.family}" font-weight="600" font-size="${f1(size)}" fill="#ffffff">${escapeXml(band.label)}</text>`,
      `<path d="${arrow.curve}" fill="none" stroke="#ffffff" stroke-width="${f1(ARROW_STROKE * scale)}" stroke-linecap="round"/>`,
      `<path d="${arrow.head}" fill="none" stroke="#ffffff" stroke-width="${f1(ARROW_STROKE * scale)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      `</g>`,
    );
  });
  const shadow = `<filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${f1(SHADOW_OFFSET * scale)}" stdDeviation="${f1(SHADOW_BLUR * scale)}" flood-color="#000000" flood-opacity="0.55"/></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(frame.width)}" height="${String(frame.height)}" viewBox="0 0 ${String(frame.width)} ${String(frame.height)}"><defs>${shadow}</defs>${parts.join("")}</svg>`;
}

/** The layer as a transparent PNG of the frame's size, drawn by resvg with the kit's hand font only. */
export function renderSplitLayerPng(split: EdlSplit, frame: Frame): Buffer {
  const svg = getSplitLayerSvg(split, frame);
  return new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: false, fontFiles: [HAND_FONT.file], defaultFontFamily: HAND_FONT.family } }).render().asPng();
}

/**
 * Writes each split segment's layer into `dir` at `frame`'s size (`split-<segment id>.png`) and answers the file
 * names by segment id, joined to `dir` (or bare with `isRelative`, for an ffmpeg run in `dir`). None without a split.
 */
export function writeSplitLayers(segments: readonly { id: string; split?: EdlSplit | undefined }[], frame: Frame, dir: string, isRelative = false): Record<string, string> {
  const files: Record<string, string> = {};
  for (const segment of segments) {
    if (segment.split === undefined) continue;
    const name = `split-${segment.id}.png`;
    writeFileSync(join(dir, name), renderSplitLayerPng(segment.split, frame));
    files[segment.id] = isRelative ? name : join(dir, name);
  }
  return files;
}

export interface SplitScreenFiltersInput {
  /** The three bands' input labels (their clips, already seeked to the band's start). */
  inputs: readonly [string, string, string];
  /** The layer's input label (`renderSplitLayerPng` looped as a video). */
  layer: string;
  split: EdlSplit;
  frame: Frame;
  /** Filters each band runs after its crop (frame rate, length), the same for all three. */
  fit: readonly string[];
  /** The label the composed picture goes out on (yuv420p, the frame's size). */
  output: string;
  /** A prefix for the graph's inner labels, unique in the graph. */
  prefix: string;
}

/**
 * The filter chains (to join with `;`) that crop each shot to its band (scaled to cover it, the crop at its `focus`),
 * stack the three and lay the layer over them.
 */
export function buildSplitScreenFilters(input: SplitScreenFiltersInput): string[] {
  const { frame, prefix: p } = input;
  const heights = getSplitBandHeights(frame);
  const bands = input.split.bands.map((band, index) => {
    const height = heights[index] as number;
    const focus = band.focus ?? 0.5;
    const chain = [
      `scale=${String(frame.width)}:${String(height)}:force_original_aspect_ratio=increase`,
      `crop=${String(frame.width)}:${String(height)}:(iw-ow)/2:(ih-oh)*${String(focus)}`,
      "setsar=1",
      ...input.fit,
    ];
    return `[${input.inputs[index] as string}]${chain.join(",")}[${p}b${String(index)}]`;
  });
  return [
    ...bands,
    `[${p}b0][${p}b1][${p}b2]vstack=inputs=3[${p}stack]`,
    `[${input.layer}]format=rgba[${p}layer]`,
    `[${p}stack][${p}layer]overlay=0:0:format=auto:shortest=1,format=yuv420p,setsar=1,settb=1/${String(FOOTAGE_FPS)},setpts=N,fps=${String(FOOTAGE_FPS)}[${input.output}]`,
  ];
}

/** The ffmpeg input of a layer PNG: one image looped at the film's rate for `seconds`. */
export function getSplitLayerInputArgs(file: string, seconds: number, fps: number): string[] {
  return ["-loop", "1", "-framerate", String(fps), "-t", String(seconds), "-i", file];
}

/**
 * The caption box a split segment takes so its captions sit in the lower half of the middle band, clear of every
 * label and arrow: its foot at 94 % of the middle band's height, in px above the frame's foot.
 */
export function getSplitCaption(frame: Frame): { bottom: number } {
  const places = getSplitPlaces(frame);
  const middle = places[1].band;
  return { bottom: frame.height - round(middle.y + 0.94 * middle.height) };
}

/**
 * Whether a caption box (its foot or its top, and the height of a card of `lines` lines) would cover a split's label
 * or arrow: the stretch of the frame's height it takes against every band's reserved stretch. Empty when clear.
 */
export function findSplitCaptionProblems(input: { at: string; caption: { bottom?: number; top?: number } | undefined; frame: Frame; cardHeight: number; lines?: number }): string[] {
  const { caption, frame } = input;
  const at = `${input.at}.caption`;
  if (caption?.bottom === undefined && caption?.top === undefined) return [`${at}: a split screen sets its own caption box, clear of its labels (bottom ${String(getSplitCaption(frame).bottom)} px puts the captions in the middle band)`];
  const height = input.cardHeight * (input.lines ?? 2);
  const foot = caption.bottom === undefined ? (caption.top as number) + height : frame.height - caption.bottom;
  const top = caption.bottom === undefined ? (caption.top as number) : foot - height;
  const covered = getSplitPlaces(frame).findIndex((place) => top < place.reserved.bottom && place.reserved.top < foot);
  if (covered === -1) return [];
  return [`${at}: the captions (${String(round(top))}-${String(round(foot))} px) would cover band ${String(covered + 1)}'s label or arrow; bottom ${String(getSplitCaption(frame).bottom)} px puts them in the middle band`];
}
