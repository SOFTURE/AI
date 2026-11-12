import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CaptionLayout, LayoutOverride } from "../compose/timeline.js";
import type { BrandColors } from "../config/colors.js";
import { err, ok } from "./failure.js";
import type { TimedWord } from "../voice/voiceover.js";
import { CAPTION_HIGHLIGHT_BOX_PADDING_EM, CAPTION_HIGHLIGHT_SECONDS, CAPTION_UNDERLINE_EM, getCaptionHighlight, type CaptionHighlightLook } from "./caption-highlight.js";
import { getCaptionChunkLayouts, getCaptionSpans, getFootageCaptionChunks, getFootageCaptionLayout, isSameCaptionPlace, type CaptionWordsFilm } from "./captions.js";
import { getCameraMoveFrames, getCameraOrigin, getCameraScaleExpression, type CameraAnchor, type EdlCamera } from "./camera.js";
import { getSegmentFadeFrames, getSegmentScales, getSegmentZoomEases } from "./compose.js";
import { toAssColor } from "./draft-color.js";
import { buildDraftOverlayEvents, getDraftOverlayStyles, getRoundedRectDrawing } from "./draft-overlays.js";
import { getCaptionCornerRadius, getCornerRadiusPx, getStylePadding, type BrandStyle } from "./brand-style.js";
import { getDraftBoxEvents } from "./draft-boxes.js";
import { createDraftTextMeasure, wrapDraftLine, type DraftTextMeasure } from "./draft-text-width.js";
import { CAPTION_PILL_PADDING } from "../compose/timeline.js";
import { estimateTextWidth, isHandFontNeeded } from "./overlays.js";
import { HAND_FONT } from "./hand-font.js";
import type { OverlayColors } from "./overlay-html.js";
import { resolveEdlOverlays, type OverlayFontRole, type ResolvedOverlay } from "./overlays.js";
import { chooseFootageDraftFont } from "./draft-font.js";
import { getEdlDuration, getSegmentStarts, remapWords, type Edl } from "./edl.js";
import { declickSpeech, describeDeclick, type DeclickReport } from "./declick.js";
import { getDeclickLevel, getFootageEdit, type FootageFilm } from "./film.js";
import { buildFilmMixArgs } from "./film-mix.js";
import { DEFAULT_LOUDNESS, formatDb, getLoudnessVerdict, measureLoudness, normalizeLoudness, type MixLoudnessTarget } from "./loudness.js";
import { duckingKeyframes, getDuckingOptions } from "./music.js";
import { FOOTAGE_FPS, getThreadArgs, type Frame } from "./normalize.js";
import {
  findFootageMusic,
  getFfmpegReporting,
  getFrame,
  getSpeechChainFiles,
  mixFootage,
  type FinishedLoudness,
  type FinishedMix,
  type FootageBrand,
  type FootageResult,
  type FootageRunOptions,
  type PreparedClip,
  type PreparedMix,
  type TranscribeOutcome,
} from "./pipeline.js";
import { runFfmpeg, withFfmpegFailureReporting } from "./process.js";
import { buildMusicArgs, buildSpeechArgs, getSpeechCutOptions } from "./render.js";

/**
 * A fast draft of a footage film, ffmpeg only (no hyperframes, no browser): the cut at a small width with the film's
 * captions burned in (its caption style, in the brand's body font and caption colours), its zoom cuts (eased as in the
 * render), cross-fades and Ken Burns b-roll drawn as the full render draws them, and the render's sound chain: the
 * speech track's stages (cut, declick, loudness pass), the ducked music when it costs nothing, and the mix brought to
 * `mixLoudness` as the render brings it (issue #1143). No end card, cover or sound effects. What an app shows the owner
 * before the paid render.
 */

export { toAssColor } from "./draft-color.js";

/** The draft's default width: 540 makes a 540×960 draft of a 9:16 film. */
export const FOOTAGE_DRAFT_WIDTH = 540;

/** The font the draft's captions are drawn with: DejaVu Sans Bold, subset to Latin with every Polish letter, shipped in `fonts/`. */
export const FOOTAGE_DRAFT_FONT = {
  family: "DejaVu Sans",
  file: fileURLToPath(new URL("../../fonts/DejaVuSans-Bold-Latin.ttf", import.meta.url)),
} as const;

/** How far a segment marked `kenburns` zooms when the film's `kenBurnsPercent` is 0, as in the render. */
const HAND_KEN_BURNS_PERCENT = 4;
const DRAFT_CRF = 28;
const DRAFT_AUDIO_BITRATE = "128k";

/** The caption colours of a `highlight` draft made without a brand. */
export const FOOTAGE_DRAFT_CAPTION_COLORS = {
  captionBackground: "#111111",
  captionText: "#ffffff",
  captionHighlight: "#ffd400",
  captionHighlightBox: "#ffd400",
  captionHighlightText: "#111111",
} as const;
/** The overlays' colours in a draft made without a brand. */
export const FOOTAGE_DRAFT_OVERLAY_COLORS: OverlayColors = { background: "#111111", foreground: "#ffffff", accent: "#ffd400" };
/** How long the render keeps a spoken word lit in the `highlight` pill. */
const HIGHLIGHT_SECONDS = CAPTION_HIGHLIGHT_SECONDS;
/** The pill's padding around its text (`CAPTION_PILL_PADDING.y`): the opaque box's border in the film's frame. */
const HIGHLIGHT_BOX_PADDING = 16;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;
const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** The draft's frame: the film's frame scaled to `width`, both sides even (H.264 yuv420p needs them even). */
export function getFootageDraftFrame(frame: Frame, width: number = FOOTAGE_DRAFT_WIDTH): Frame {
  const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);
  return { width: even(width), height: even((width * frame.height) / frame.width) };
}

/** An ASS time: `H:MM:SS.cc`. */
function toAssTime(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centiseconds % 100)}`;
}

/**
 * Caption text as ASS dialogue: override braces and backslashes would be read as tags, line breaks end the line. A
 * no-break space (U+00A0) becomes ASS's hard space `\h`, which libass never breaks a line at, as the render's HTML.
 */
function toAssText(text: string): string {
  return text
    .replace(/\\/g, "/")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/[^\S\u00a0]+/g, " ")
    .replace(/^ +| +$/g, "")
    .replace(/\u00a0/g, "\\h");
}

/** The caption colours the draft paints with (`BrandColors`). */
export type FootageDraftCaptionColors = Pick<BrandColors, "captionBackground" | "captionText" | "captionHighlight" | "captionHighlightBox" | "captionHighlightText">;

export interface FootageDraftCaptionsInput {
  film: Pick<FootageFilm, "captions" | "captionStyle" | "captionHighlightStyle"> & CaptionWordsFilm;
  edl: Edl;
  /** The film's words in film time (`remapWords`). */
  words: TimedWord[];
  /** The caption box in the film's frame (`getFootageCaptionLayout`). */
  caption: CaptionLayout;
  /** The film's full frame; the ASS file is laid out in it and libass scales it to the draft. */
  frame: Frame;
  /** The font family the captions are drawn in, as the font file names it; default `FOOTAGE_DRAFT_FONT.family`. */
  fontFamily?: string;
  /** The `highlight` pill's colours; default `FOOTAGE_DRAFT_CAPTION_COLORS`. A `phrase` caption is white, as in the render. */
  colors?: FootageDraftCaptionColors;
  /** The EDL's overlays, resolved (`resolveEdlOverlays`), drawn over the captions' layers; absent: none. */
  overlays?: ResolvedOverlay[];
  /** The overlays' card, text and accent colours; default `FOOTAGE_DRAFT_OVERLAY_COLORS`. */
  overlayColors?: OverlayColors;
  /** The overlays' heading and interface font families where they are not `fontFamily` (as the font files name them). */
  overlayFonts?: Partial<Record<OverlayFontRole, string>>;
  /** How a counter groups its number (BCP 47); default `en-US`. */
  locale?: string;
  /**
   * The brand's style (`FootageBrand.style`): a `highlight` chunk is drawn on a rounded pill of its radius, padding,
   * shadow and border, its lines broken by `measure`; the overlay cards take its radius, shadow and border. Absent:
   * libass's square box, as before.
   */
  style?: BrandStyle;
  /** The width of a line in the captions' font (`createDraftTextMeasure`); absent or null: the `OVERLAY_CHAR_EM` estimate. */
  measure?: DraftTextMeasure | null;
}

/** The pieces of a `highlight` chunk's span: cut wherever a word lights up or goes out (in centiseconds), with the words lit in each. */
function getHighlightPieces(chunk: { words: TimedWord[] }, span: { start: number; end: number }): { from: number; to: number; lit: boolean[] }[] {
  const cs = (seconds: number): number => Math.round(seconds * 100);
  const [from, to] = [cs(span.start), cs(span.end)];
  const lights = chunk.words.map((word) => ({ on: cs(word.start), off: cs(word.start + HIGHLIGHT_SECONDS) }));
  const cuts = [...new Set([from, to, ...lights.flatMap((light) => [light.on, light.off])])].filter((at) => at >= from && at <= to).sort((a, b) => a - b);
  return cuts.slice(0, -1).map((at, index) => ({ from: at, to: cuts[index + 1] as number, lit: lights.map((light) => light.on <= at && at < light.off) }));
}

/** Words joined for one ASS line: a space, or `\\N` after the words a drawn pill's lines end on. */
function joinWords(words: readonly string[], breaks: ReadonlySet<number>): string {
  return words.map((word, index) => (index === 0 ? word : `${breaks.has(index - 1) ? "\\N" : " "}${word}`)).join("");
}

/** How a chunk's events are laid out: its line breaks, and whether a drawn pill stands under it (so libass draws no box). */
interface ChunkLayout {
  breaks: ReadonlySet<number>;
  hasPill: boolean;
}

const BOXLESS_LAYOUT: ChunkLayout = { breaks: new Set(), hasPill: false };
/** The tags that hide libass's own box of a `BorderStyle 3` style, for text over a drawn pill. */
const NO_BOX = "{\\3a&HFF&\\4a&HFF&}";

/**
 * A `highlight` chunk as ASS events: its span cut wherever a word lights up or goes out, each piece showing the chunk
 * with the words lit then in `highlight` (a word stays lit for the render's 0.32 s from its start).
 */
function buildHighlightEvents(chunk: { words: TimedWord[] }, span: { start: number; end: number }, colors: { text: string; highlight: string }, styleName: string, layout: ChunkLayout = BOXLESS_LAYOUT, isUnderlined = false): string[] {
  const [on, off] = isUnderlined ? ["\\u1", "\\u0"] : ["", ""];
  return getHighlightPieces(chunk, span).map((piece) => {
    const words = chunk.words.map((word, wordIndex) => (piece.lit[wordIndex] === true ? `{${on}\\1c${colors.highlight}&}${toAssText(word.text)}{${off}\\1c${colors.text}&}` : toAssText(word.text)));
    return `Dialogue: 0,${toAssTime(piece.from / 100)},${toAssTime(piece.to / 100)},${styleName},,0,0,0,,${layout.hasPill ? NO_BOX : ""}${joinWords(words, layout.breaks)}`;
  });
}

/**
 * A `box` highlight chunk as ASS events (issue #1199), three layers per piece of its span. libass draws a
 * `BorderStyle 3` box per glyph, in each glyph's own `\3c` and `\3a`, so the layers share one layout: 0 is the pill
 * (its text hidden; left out over a drawn pill), 1 the lit word's box (every other glyph's box transparent, grown by
 * `boxPadding` instead of the pill's), 2 the text alone (no box) with the lit word in its box text colour.
 */
function buildHighlightBoxEvents(
  chunk: { words: TimedWord[] },
  span: { start: number; end: number },
  colors: { text: string; box: string; boxText: string },
  boxPadding: number,
  styleName: string,
  layout: ChunkLayout = BOXLESS_LAYOUT,
): string[] {
  return getHighlightPieces(chunk, span).flatMap((piece) => {
    const at = `${toAssTime(piece.from / 100)},${toAssTime(piece.to / 100)},${styleName},,0,0,0,,`;
    const shown = chunk.words.map((word) => toAssText(word.text));
    const pill = `{\\1a&HFF&}${joinWords(shown, layout.breaks)}`;
    const box = `{\\1a&HFF&\\bord${boxPadding}\\3a&HFF&}${joinWords(
      shown.map((text, index) => (piece.lit[index] === true ? `{\\3c${colors.box}&\\3a&H00&}${text}{\\3a&HFF&}` : text)),
      layout.breaks,
    )}`;
    const text = `{\\3a&HFF&\\4a&HFF&}${joinWords(
      shown.map((word, index) => (piece.lit[index] === true ? `{\\1c${colors.boxText}&}${word}{\\1c${colors.text}&}` : word)),
      layout.breaks,
    )}`;
    const isLit = piece.lit.some((lit) => lit);
    return [...(layout.hasPill ? [] : [`Dialogue: 0,${at}${pill}`]), ...(isLit ? [`Dialogue: 1,${at}${box}`] : []), `Dialogue: 2,${at}${text}`];
  });
}

/** Where a word of a drawn pill sits: its left edge, width and its line's top, in the draft's frame. */
interface DrawnWord {
  left: number;
  width: number;
  lineTop: number;
}

/** The pill of a chunk drawn in the brand's style: its lines (broken by width), its shadow, box and border events, and each word's place. */
interface DrawnPill {
  breaks: Set<number>;
  events: string[];
  words: DrawnWord[];
}

interface DrawnPillInput {
  words: readonly string[];
  span: { start: number; end: number };
  place: CaptionLayout;
  frame: Frame;
  style: BrandStyle;
  measure: DraftTextMeasure;
  colors: { background: string; accent: string };
}

/**
 * A chunk's rounded pill (`style`): its words broken greedily into lines that fit the caption box less the padding,
 * the pill as wide as the widest line and as tall as the lines (libass draws a line one font size tall) plus the
 * padding, centred in the box and hung from its foot (or its top) as the text is.
 */
function getDrawnPill(input: DrawnPillInput): DrawnPill {
  const { place, frame, style, measure } = input;
  const scale = frame.width / 1080;
  const pad = getStylePadding(CAPTION_PILL_PADDING, style.padding);
  const areaWidth = frame.width - place.left - place.right;
  const lines = wrapDraftLine(input.words, areaWidth - 2 * pad.x, place.fontSize, measure);
  const breaks = new Set<number>();
  let counted = 0;
  for (const line of lines.slice(0, -1)) {
    counted += line.length;
    breaks.add(counted - 1);
  }
  const width = Math.min(areaWidth, Math.max(...lines.map((line) => measure(line.join(" "), place.fontSize))) + 2 * pad.x);
  const height = lines.length * place.fontSize + 2 * pad.y;
  const textTop = place.bottom === undefined ? place.top : frame.height - place.bottom - lines.length * place.fontSize;
  const box = { left: place.left + (areaWidth - width) / 2, top: textTop - pad.y, width, height };
  const at = `${toAssTime(input.span.start)},${toAssTime(input.span.end)}`;
  const radius = getCornerRadiusPx(getCaptionCornerRadius(style), height, scale);
  // libass centres each line in the caption box, as the pill is: a word starts where the words before it and a space end.
  const words = lines.flatMap((line, lineIndex) => {
    const lineLeft = place.left + (areaWidth - measure(line.join(" "), place.fontSize)) / 2;
    return line.map((word, index) => {
      const width = measure(word, place.fontSize);
      return { left: lineLeft + measure(line.slice(0, index + 1).join(" "), place.fontSize) - width, width, lineTop: textTop + lineIndex * place.fontSize };
    });
  });
  return { breaks, events: getDraftBoxEvents({ layer: 0, at, styleName: "CaptionShape", box, radius, color: input.colors.background, accent: input.colors.accent, style, scale }), words };
}

/** Where the draft's underline sits under a line, in font sizes: libass draws a line one font size tall, its baseline near 0.8. */
const DRAFT_UNDERLINE_TOP_EM = 0.9;

/**
 * An `underline` highlight's bars over a drawn pill: for each piece of the chunk's span, a rounded bar in `color` under
 * every word lit then, as wide as the word, `CAPTION_UNDERLINE_EM.thickness` font sizes thick.
 */
function buildUnderlineEvents(chunk: { words: TimedWord[] }, span: { start: number; end: number }, words: readonly DrawnWord[], fontSize: number, color: string): string[] {
  const thickness = Math.max(2, Math.round(fontSize * CAPTION_UNDERLINE_EM.thickness));
  return getHighlightPieces(chunk, span).flatMap((piece) =>
    words.flatMap((word, index) => {
      if (piece.lit[index] !== true) return [];
      const bar = { left: word.left, top: word.lineTop + Math.round(fontSize * DRAFT_UNDERLINE_TOP_EM), width: word.width, height: thickness };
      return [`Dialogue: 0,${toAssTime(piece.from / 100)},${toAssTime(piece.to / 100)},CaptionShape,,0,0,0,,{\\an7\\pos(0,0)${toUnderlineColorTags(color)}\\bord0\\shad0\\p1}${getRoundedRectDrawing(bar, thickness / 2)}{\\p0}`];
    }),
  );
}

/** A `#rrggbb` colour as an ASS fill colour and alpha. */
function toUnderlineColorTags(hex: string): string {
  const ass = toAssColor(hex);
  return `\\1c&H${ass.slice(4)}&\\1a&H${ass.slice(2, 4)}&`;
}

/** The highlight look the draft draws: `text` for a `phrase` film; a `box` film without its colours is an input error. */
function getDraftHighlightLook(film: Pick<FootageFilm, "captionStyle" | "captionHighlightStyle">, colors: FootageDraftCaptionColors): CaptionHighlightLook {
  if (film.captionStyle !== "highlight") return { style: "text", color: colors.captionHighlight };
  const highlight = getCaptionHighlight(film, colors);
  if (!highlight.ok) throw new Error(`buildFootageDraftCaptions: ${highlight.error}`);
  return highlight.look;
}

/**
 * The draft's captions as an ASS subtitle file, shown for the render's spans (`getCaptionSpans`) and centred in the
 * caption box from its top (or from its foot, with `bottom`). `phrase` (the default): the film's phrases
 * (`phraseChunks`), white bold text with a dark outline and shadow. `highlight`: the render's chunks of up to four
 * words (`captionChunks`) on an opaque box of `captionBackground`, in `captionText`, the word being said in
 * `captionHighlight`. Both keep the film's kept words with the next, as the render does. Null when the film has no
 * captions or nothing is said.
 */
export function buildFootageDraftCaptions(input: FootageDraftCaptionsInput): string | null {
  const overlays = input.overlays ?? [];
  const isHighlight = input.film.captionStyle === "highlight";
  // No chunks without captions (`getFootageCaptionChunks`): then only the overlays, if any, make the file.
  const chunks = input.film.captions ? getFootageCaptionChunks(input.film, input.words) : [];
  if (chunks.length === 0 && overlays.length === 0) return null;
  const spans = getCaptionSpans(chunks, getEdlDuration(input.edl));
  const { caption, frame } = input;
  const family = (input.fontFamily ?? FOOTAGE_DRAFT_FONT.family).replace(/,/g, " ");
  const colors = input.colors ?? FOOTAGE_DRAFT_CAPTION_COLORS;
  const text = toAssColor(colors.captionText);
  const box = toAssColor(colors.captionBackground);
  // libass draws BorderStyle 3's box in the outline colour, grown by the outline width; the back colour is its shadow.
  const look = isHighlight
    ? { primary: text, outlineColor: box, backColor: box, borderStyle: 3, outline: HIGHLIGHT_BOX_PADDING, shadow: 0 }
    : {
        primary: "&H00FFFFFF",
        outlineColor: "&H8C000000",
        backColor: "&H8C000000",
        borderStyle: 1,
        outline: Math.max(1, Math.round(caption.fontSize / 16)),
        shadow: Math.max(1, Math.round(caption.fontSize / 25)),
      };
  const toStyle = (name: string, place: CaptionLayout): string => [
    name,
    family,
    caption.fontSize,
    look.primary,
    look.primary,
    look.outlineColor,
    look.backColor,
    -1,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    look.borderStyle,
    look.outline,
    look.shadow,
    // ASS alignment 2 hangs the text from MarginV above the bottom, 8 from MarginV below the top.
    place.bottom === undefined ? 8 : 2,
    Math.round(place.left),
    Math.round(place.right),
    Math.round(place.bottom ?? place.top),
    1,
  ].join(",");
  // A chunk in a segment's own box gets a style of that box (Caption2, Caption3, ...); the film's box stays `Caption`.
  const styles = [toStyle("Caption", caption)];
  const moved: CaptionLayout[] = [];
  const places = getCaptionChunkLayouts(chunks, input.edl, caption);
  const styleNames = places.map((place) => {
    if (isSameCaptionPlace(place, caption)) return "Caption";
    let index = moved.findIndex((other) => isSameCaptionPlace(other, place));
    if (index === -1) {
      index = moved.push(place) - 1;
      styles.push(toStyle(`Caption${index + 2}`, place));
    }
    return `Caption${index + 2}`;
  });
  const highlight = { text: text.replace(/^&H../, "&H"), highlight: toAssColor(colors.captionHighlight).replace(/^&H../, "&H") };
  const lit = getDraftHighlightLook(input.film, colors);
  const boxColors = lit.style === "box" ? { text: highlight.text, box: toAssColor(lit.box).replace(/^&H../, "&H"), boxText: toAssColor(lit.text).replace(/^&H../, "&H") } : null;
  const boxPadding = Math.max(1, Math.round(caption.fontSize * CAPTION_HIGHLIGHT_BOX_PADDING_EM));
  // With the brand's style a `highlight` chunk stands on a drawn rounded pill (its lines broken here), not libass's box.
  const style = isHighlight ? input.style : undefined;
  const measure = input.measure ?? ((line: string, size: number) => estimateTextWidth(line, size));
  const pillColors = { background: colors.captionBackground, accent: lit.style === "box" ? lit.box : colors.captionHighlight };
  const events = chunks.flatMap((chunk, index) => {
    const span = spans[index] as { start: number; end: number };
    const styleName = styleNames[index] ?? "Caption";
    const pill =
      style === undefined ? null : getDrawnPill({ words: chunk.words.map((word) => word.text.replace(/\u00a0/g, " ")), span, place: places[index] ?? caption, frame, style, measure, colors: pillColors });
    const layout: ChunkLayout = pill === null ? BOXLESS_LAYOUT : { breaks: pill.breaks, hasPill: true };
    const drawn = pill?.events ?? [];
    if (isHighlight && lit.style === "underline") {
      // Over a drawn pill the bar is drawn under the lit word, its text unchanged; without one libass underlines it in the accent.
      if (pill === null) return buildHighlightEvents(chunk, span, highlight, styleName, layout, true);
      return [...drawn, ...buildUnderlineEvents(chunk, span, pill.words, (places[index] ?? caption).fontSize, colors.captionHighlight), ...buildHighlightEvents(chunk, span, { text: highlight.text, highlight: highlight.text }, styleName, layout)];
    }
    if (isHighlight && boxColors !== null) return [...drawn, ...buildHighlightBoxEvents(chunk, span, boxColors, boxPadding, styleName, layout)];
    if (isHighlight) return [...drawn, ...buildHighlightEvents(chunk, span, highlight, styleName, layout)];
    const line = toAssText(chunk.words.map((word) => word.text).join(" "));
    return [`Dialogue: 0,${toAssTime(span.start)},${toAssTime(span.end)},${styleName},,0,0,0,,${line}`];
  });
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${frame.width}`,
    `PlayResY: ${frame.height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles.map((line) => `Style: ${line}`),
    ...(style === undefined || chunks.length === 0 ? [] : [`Style: CaptionShape,${family},${String(caption.fontSize)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`]),
    ...(overlays.length === 0 ? [] : getDraftOverlayStyles(family, input.overlayColors ?? FOOTAGE_DRAFT_OVERLAY_COLORS)),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    ...buildDraftOverlayEvents(overlays, input.overlayColors ?? FOOTAGE_DRAFT_OVERLAY_COLORS, input.frame, {
      ...(input.overlayFonts === undefined ? {} : { fonts: input.overlayFonts }),
      ...(input.locale === undefined ? {} : { locale: input.locale }),
      ...(input.style === undefined ? {} : { style: input.style }),
    }),
    "",
  ].join("\n");
}

export interface FootageDraftArgsInput {
  film: Pick<FootageFilm, "edit">;
  edl: Edl;
  /** The normalized clips by id. */
  clips: Record<string, string>;
  /** The cut speech track (`buildSpeechArgs`). */
  speech: string;
  /** The ducked music track (`buildMusicArgs`, as long as the cut), mixed under the speech; null or absent for none. */
  music?: string | null;
  /**
   * The film's mix, already brought to its target and encoded to AAC (`mixFootage`): the draft copies it as its sound
   * and reads neither `speech` nor `music`. Null or absent: the draft mixes `speech` and `music` and encodes them.
   */
  mix?: string | null;
  /** The film's full frame (the normalized clips' size). */
  frame: Frame;
  /** The draft's width; default 540. */
  width?: number;
  /** The ASS captions file (`buildFootageDraftCaptions`), or null for none. */
  captions: string | null;
  /** The EDL's resolved overlays: their `punch_in` zooms are drawn into the picture (the rest is in the ASS file). */
  overlays?: readonly ResolvedOverlay[];
  /** The folder libass loads the captions' font from, or null for the system's fonts. */
  fontsDir: string | null;
  output: string;
  /**
   * ffmpeg's threads for every segment's decoder, the filter graph and the encoder; by default ffmpeg's own choice,
   * which follows the host's cores, not a container's CPU quota. A positive whole number.
   */
  threads?: number;
}

/** A segment's picture as the draft plays it: how long its stream runs and the fade it starts with. */
export interface DraftSegmentPlan {
  /** The segment's own length in the cut. */
  length: number;
  /** Seconds the segment's stream runs: its length plus the fade into the next segment, which plays over its end. */
  seconds: number;
  /** The film second the segment starts at. */
  start: number;
  /** The cross-fade from the segment before, in seconds; 0 for a plain cut. */
  fade: number;
  /** The zoom the segment starts at (`getSegmentScales`). */
  scale: number;
  /** The zoom it ends at: above `scale` for a `kenburns` segment, `scale` otherwise. */
  endScale: number;
  /** The zoom on screen before an eased `zoom` cut, which the segment eases from to `scale`; `scale` otherwise. */
  startScale: number;
  /** The frames the zoom eases over (`getSegmentZoomEases`); 0: the segment starts at `scale`. */
  easeFrames: number;
  /** The segment's camera (`EdlCamera`) and the frames its move takes; null: the film's own zoom (`scale`, `endScale`). */
  camera: { camera: EdlCamera; frames: number } | null;
  /** The point the segment's zooms keep still: its camera's anchor, else the render's `transform-origin: 50% 42%`. */
  origin: CameraAnchor;
  /**
   * The EDL's `punch_in` overlays in this segment, in frames from its start: each multiplies the zoom by up to `scale`,
   * rising over `ease` frames from `from` and falling over the last `ease` of its `frames` (linear, the render eases).
   */
  punches: { from: number; frames: number; ease: number; scale: number }[];
}

/**
 * How each segment plays in the draft. A `fade` cut lasts its own `fadeFrames` or the film's (clamped to the incoming
 * segment, so the cross-fade never outlasts it) and the outgoing segment runs on under it, as in the render.
 */
export function planFootageDraft(film: Pick<FootageFilm, "edit">, edl: Edl, overlays: readonly ResolvedOverlay[] = []): DraftSegmentPlan[] {
  const edit = getFootageEdit(film);
  const kenBurnsScale = 1 + (edit.kenBurnsPercent > 0 ? edit.kenBurnsPercent : HAND_KEN_BURNS_PERCENT) / 100;
  const scales = getSegmentScales(edl, edit.zoomPercent);
  const eases = getSegmentZoomEases(edl, edit);
  const starts = getSegmentStarts(edl);
  const fades = edl.segments.map((segment, index) => r3(Math.min(getSegmentFadeFrames(edl, index, edit) / FOOTAGE_FPS, segment.end - segment.start)));
  return edl.segments.map((segment, index) => {
    const scale = scales[index] as number;
    return {
      length: r3(segment.end - segment.start),
      seconds: r3(segment.end - segment.start + (fades[index + 1] ?? 0)),
      start: starts[index] as number,
      fade: fades[index] as number,
      scale,
      endScale: segment.camera !== undefined ? segment.camera.to : segment.motion === "kenburns" ? r4(scale * kenBurnsScale) : scale,
      startScale: (eases[index] as number) > 0 ? (scales[index - 1] as number) : scale,
      easeFrames: eases[index] as number,
      camera: segment.camera === undefined ? null : { camera: segment.camera, frames: getCameraMoveFrames(segment.camera, segment.end - segment.start) },
      origin: getCameraOrigin(segment.camera),
      punches: overlays.flatMap((overlay) =>
        overlay.kind === "punch_in" && overlay.segment === index
          ? [
              {
                from: Math.round((overlay.start - (starts[index] as number)) * FOOTAGE_FPS),
                frames: Math.round((overlay.end - overlay.start) * FOOTAGE_FPS),
                ease: Math.max(1, Math.round(overlay.ease * FOOTAGE_FPS)),
                scale: overlay.scale,
              },
            ]
          : [],
      ),
    };
  });
}

/**
 * The filters that zoom a segment's picture and scale it to the draft: a crop for a still zoom, `zoompan` for Ken Burns,
 * a camera's move and an eased zoom cut (the render's `power1.out`: `1 - (1 - t)^2`), each about the segment's origin.
 */
function buildPictureFilters(plan: DraftSegmentPlan, draft: Frame): string[] {
  const size = `${draft.width}:${draft.height}`;
  const { origin } = plan;
  const zoompan = (zoom: string): string =>
    `zoompan=z='${zoom}':x='(iw-iw/zoom)*${origin.x}':y='(ih-ih/zoom)*${origin.y}':d=1:s=${draft.width}x${draft.height}:fps=${FOOTAGE_FPS}`;
  // The zoom runs over the segment's own length, as the render's tween does, and holds through a fade's tail.
  const frames = Math.max(1, Math.round(plan.length * FOOTAGE_FPS));
  const own =
    plan.easeFrames > 0
      ? `${plan.startScale}+(${r4(plan.scale - plan.startScale)})*(1-pow(1-min(on/${plan.easeFrames},1),2))`
      : plan.camera !== null && plan.endScale !== plan.scale
        ? getCameraScaleExpression(plan.camera.camera, plan.camera.frames)
        : plan.endScale !== plan.scale
          ? `${plan.scale}+${r4(plan.endScale - plan.scale)}*min(on/${frames},1)`
          : null;
  if (plan.punches.length > 0) {
    // The segment's own zoom (an eased cut, a camera, Ken Burns or still) times each punch-in's rise, hold and fall.
    const lifts = plan.punches.map((punch) => `${r4(punch.scale - 1)}*max(0,min(min(1,(on-${punch.from})/${punch.ease}),(${punch.from + punch.frames}-on)/${punch.ease}))`);
    return [zoompan(`(${own ?? String(plan.scale)})*(1+${lifts.join("+")})`)];
  }
  if (own !== null) return [zoompan(own)];
  if (plan.scale !== 1) {
    return [`crop=iw/${plan.scale}:ih/${plan.scale}:(iw-iw/${plan.scale})*${origin.x}:(ih-ih/${plan.scale})*${origin.y}`, `scale=${size}`];
  }
  return [`scale=${size}`];
}

/**
 * The ffmpeg arguments of the draft: each segment read from its own seek into its clip, zoomed and scaled to the
 * draft's width, joined by `xfade` at `fade` cuts and `concat` at the others, the captions burned in (`ass`), the
 * film's mix copied under it (or the speech and music tracks mixed and encoded to AAC); H.264 yuv420p with fast start,
 * exactly the cut's length.
 */
export function buildFootageDraftArgs(input: FootageDraftArgsInput): string[] {
  const { edl } = input;
  const draft = getFootageDraftFrame(input.frame, input.width);
  const plans = planFootageDraft(input.film, edl, input.overlays ?? []);
  const threads = getThreadArgs(input.threads, "draft.threads");
  const inputs: string[] = [];
  const parts: string[] = [];
  edl.segments.forEach((segment, index) => {
    const clip = input.clips[segment.clip];
    if (clip === undefined) throw new Error(`No file for clip "${segment.clip}" of the EDL.`);
    const plan = plans[index] as DraftSegmentPlan;
    // Before an input, -threads sizes that input's decoder: one decoder runs per segment.
    inputs.push(...threads.output, "-ss", String(r3(segment.start)), "-t", String(plan.seconds), "-i", clip);
    const filters = [
      "setpts=PTS-STARTPTS",
      ...buildPictureFilters(plan, draft),
      "setsar=1",
      `fps=${FOOTAGE_FPS}`,
      "format=yuv420p",
      // A clip that ends before the segment's end (and its fade's tail) holds its last frame, so every stream runs its full length.
      `tpad=stop_mode=clone:stop_duration=${plan.seconds}`,
      `trim=duration=${plan.seconds}`,
      "setpts=PTS-STARTPTS",
      `settb=1/${FOOTAGE_FPS}`,
      // ffmpeg 7.1's setpts leaves the frame rate unknown (1/0), which xfade refuses (#1057); fps states it again.
      `fps=${FOOTAGE_FPS}`,
    ];
    parts.push(`[${index}:v]${filters.join(",")}[v${index}]`);
  });
  let joined = "v0";
  plans.forEach((plan, index) => {
    if (index === 0) return;
    const label = `j${index}`;
    parts.push(
      plan.fade > 0
        ? `[${joined}][v${index}]xfade=transition=fade:duration=${plan.fade}:offset=${plan.start}[${label}]`
        : // concat changes the time base; xfade needs both of its inputs on the segments' own.
          `[${joined}][v${index}]concat=n=2:v=1:a=0,settb=1/${FOOTAGE_FPS},fps=${FOOTAGE_FPS}[${label}]`,
    );
    joined = label;
  });
  if (input.captions !== null) {
    parts.push(`[${joined}]ass=filename=${input.captions}${input.fontsDir === null ? "" : `:fontsdir=${input.fontsDir}`}[draft]`);
  } else {
    parts.push(`[${joined}]null[draft]`);
  }
  const soundInput = edl.segments.length;
  const mix = input.mix ?? null;
  const music = mix === null ? (input.music ?? null) : null;
  if (music !== null) parts.push(`[${soundInput}:a][${soundInput + 1}:a]amix=inputs=2:duration=first:normalize=0[sound]`);
  const seconds = getEdlDuration(edl);
  // A prepared mix is copied: it was measured as encoded, and a second encode would move its loudness and true peak.
  const audioCodec = mix === null ? ["-c:a", "aac", "-b:a", DRAFT_AUDIO_BITRATE] : ["-c:a", "copy"];
  return [
    "-v",
    "error",
    "-y",
    ...threads.global,
    ...inputs,
    "-i",
    mix ?? input.speech,
    ...(music === null ? [] : ["-i", music]),
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[draft]",
    "-map",
    music === null ? `${soundInput}:a` : "[sound]",
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(DRAFT_CRF),
    "-pix_fmt",
    "yuv420p",
    ...audioCodec,
    "-movflags",
    "+faststart",
    ...threads.output,
    input.output,
  ];
}

export interface RenderFootageDraftOptions extends Pick<FootageRunOptions, "buildDir" | "log" | "signal" | "onProgress" | "onFfmpegFailure">, Partial<Pick<FootageRunOptions, "cacheDir" | "providers">> {
  /** The draft MP4. */
  output: string;
  /** The draft's width; default 540 (540×960 for a 9:16 film). */
  width?: number;
  /** A project's override of the format's caption box (`marketing.json` `layout`), as the render takes it. */
  layout?: LayoutOverride;
  /**
   * The brand the render takes (`renderFootage`'s `brand`): the captions are drawn in its body font (a TrueType or
   * OpenType file; DejaVu Sans when it has none) and its caption colours. Without it, DejaVu Sans and
   * `FOOTAGE_DRAFT_CAPTION_COLORS`.
   */
  brand?: { colors: FootageDraftCaptionColors & Partial<OverlayColors>; fonts: Pick<FootageBrand["fonts"], "body"> & Partial<Pick<FootageBrand["fonts"], "heading" | "interface">>; locale?: string; style?: BrandStyle };
  /**
   * ffmpeg's threads for the draft's decoders, filter graph and encoder (`buildFootageDraftArgs`); by default ffmpeg's
   * own choice, which follows the host's cores. Set it from a CPU-limited container's quota.
   */
  threads?: number;
}

/** The draft's music: the film has none, it played (a file, or generated music from the cache), or it is not cached yet. */
export type FootageDraftMusic = "none" | "played" | "not_cached";

export interface FootageDraft {
  output: string;
  music: FootageDraftMusic;
  /** The family the captions are drawn in; null without captions. */
  captionFont: string | null;
  /** The draft's length: the cut's. */
  seconds: number;
  width: number;
  height: number;
  bytes: number;
  /** What the speech track's declick stage did, as the render does it; null when the film's declick is off. */
  declick: DeclickReport | null;
  /**
   * The draft's sound as measured, as the render measures its finished film (`warning` on a near miss inside
   * `mixLoudness.warnTolerance`); null for a silent draft.
   */
  loudness: FinishedLoudness | null;
  /** What the mix stage did, as in the render; null when it did not run (`mixLoudness: null`, a silent mix). */
  mix: FinishedMix | null;
}

/** The draft's music track: a file to duck, or why there is none. */
type DraftMusicSource = { kind: "file"; path: string } | { kind: "none" } | { kind: "not_cached"; reason: string };

/**
 * The music the draft can play without spending: the film's own file, or generated music already in the paid cache
 * (looked up as the render looks it up, `findFootageMusic`). Never calls a provider.
 */
async function findDraftMusic(film: FootageFilm, edl: Edl, clips: PreparedClip[], options: RenderFootageDraftOptions): Promise<FootageResult<DraftMusicSource>> {
  const source = film.music.source;
  if (source.kind === "none") return ok({ kind: "none" });
  if (source.kind === "file") return existsSync(source.path) ? ok({ kind: "file", path: source.path }) : err(`music: no file at ${source.path}`, { kind: "input" });
  const { cacheDir, providers } = options;
  if (cacheDir === undefined || providers === undefined) {
    return ok({ kind: "not_cached", reason: "the film's music is generated and the draft was given no cacheDir and providers to find it in the cache" });
  }
  const found = await findFootageMusic(film, edl, clips, { cacheDir, providers });
  if (!found.ok) return found;
  const music = found.value;
  if (music.kind === "none") return ok({ kind: "none" });
  if (music.kind === "file") return ok({ kind: "file", path: music.path });
  if (music.kind === "cached") return ok({ kind: "file", path: music.cache.path });
  return ok({ kind: "not_cached", reason: `the film's generated music is not in the cache yet (${music.cache.path}); the render buys it` });
}

/**
 * Makes the draft of a cut film: the speech track, the ducked music track (when it costs nothing), the captions file
 * and its font in `<buildDir>/draft/`, then one ffmpeg run (`buildFootageDraftArgs`). Spends nothing: no provider is
 * called; takes the same clips, transcript and EDL as `renderFootage`.
 */
export function renderFootageDraft(film: FootageFilm, clips: PreparedClip[], transcript: Extract<TranscribeOutcome, { kind: "ready" }>, edl: Edl, options: RenderFootageDraftOptions): Promise<FootageResult<FootageDraft>> {
  return withFfmpegFailureReporting(getFfmpegReporting(options), () => runRenderFootageDraft(film, clips, transcript, edl, options));
}

/** The body of `renderFootageDraft`, inside its ffmpeg failure reporting. */
async function runRenderFootageDraft(
  film: FootageFilm,
  clips: PreparedClip[],
  transcript: Extract<TranscribeOutcome, { kind: "ready" }>,
  edl: Edl,
  options: RenderFootageDraftOptions,
): Promise<FootageResult<FootageDraft>> {
  const { log, signal } = options;
  const aborting = signal === undefined ? {} : { signal };
  const highlight = film.captions && film.captionStyle === "highlight" ? getCaptionHighlight(film, options.brand?.colors ?? FOOTAGE_DRAFT_CAPTION_COLORS) : null;
  if (highlight !== null && !highlight.ok) return err(`footage film ${film.id}: ${highlight.error}`, { kind: "input" });
  const seconds = getEdlDuration(edl);
  const music = await findDraftMusic(film, edl, clips, options);
  if (!music.ok) return music;
  const draftDir = resolve(options.buildDir, "draft");
  rmSync(draftDir, { recursive: true, force: true });
  mkdirSync(draftDir, { recursive: true });
  const declickLevel = getDeclickLevel(film);
  const loudness = film.loudness === undefined ? DEFAULT_LOUDNESS : film.loudness;
  const mixLoudness = film.mixLoudness === undefined ? DEFAULT_LOUDNESS : film.mixLoudness;
  const hasMusic = music.value.kind === "file";
  const items = [
    "speech",
    ...(declickLevel === "off" ? [] : ["declick"]),
    ...(loudness === null ? [] : ["loudness"]),
    ...(hasMusic ? ["music"] : []),
    ...(mixLoudness === null ? [] : ["mix"]),
    "film",
  ];
  const report = (item: string, done: number): void => {
    const itemIndex = items.indexOf(item) + 1;
    options.onProgress?.({ step: "draft", item, itemIndex, itemCount: items.length, done: Math.min(seconds * items.length, (itemIndex - 1) * seconds + done), total: seconds * items.length });
  };
  const clipFiles = Object.fromEntries(clips.map((clip) => [clip.clip.id, resolve(clip.file)]));
  // The render's speech chain and its file names, so the draft's sound is made as the render's is.
  const { rawSpeechFile, declickedFile, speechFile } = getSpeechChainFiles(draftDir, { isDeclick: declickLevel !== "off", isLoudness: loudness !== null });
  const words = remapWords(edl, transcript.words, film.cut.fillers);
  const frame = getFrame(film);
  const resolved = resolveEdlOverlays({ film, edl, words, frame, caption: getFootageCaptionLayout(film, options.layout ?? {}), ...(options.brand?.style === undefined ? {} : { style: options.brand.style }) });
  if (!resolved.ok) return err(`footage film ${film.id}: the EDL's overlays cannot be drawn: ${resolved.problems.join("; ")}`, { kind: "input" });
  const overlays = resolved.overlays;
  const brandColors = options.brand?.colors;
  const overlayColors =
    brandColors?.background !== undefined && brandColors.foreground !== undefined && brandColors.accent !== undefined
      ? { background: brandColors.background, foreground: brandColors.foreground, accent: brandColors.accent }
      : FOOTAGE_DRAFT_OVERLAY_COLORS;
  const brandFont = chooseFootageDraftFont(options.brand?.fonts.body ?? null);
  const font = brandFont ?? FOOTAGE_DRAFT_FONT;
  // The overlays' heading and interface fonts, where the brand has a TrueType or OpenType file for them.
  const roleFonts = Object.fromEntries(
    (["heading", "interface"] as const).flatMap((role) => {
      const chosen = overlays.length === 0 ? null : chooseFootageDraftFont(options.brand?.fonts[role] ?? null);
      return chosen === null || chosen.family === font.family ? [] : [[role, chosen]];
    }),
  ) as Partial<Record<OverlayFontRole, { family: string; file: string }>>;
  const captions = buildFootageDraftCaptions({
    film,
    edl,
    words,
    caption: getFootageCaptionLayout(film, options.layout ?? {}),
    frame,
    fontFamily: font.family,
    ...(options.brand === undefined ? {} : { colors: options.brand.colors }),
    ...(overlays.length === 0 ? {} : { overlays, overlayColors }),
    ...(Object.keys(roleFonts).length === 0 ? {} : { overlayFonts: Object.fromEntries(Object.entries(roleFonts).map(([role, chosen]) => [role, chosen.family])) }),
    ...(options.brand?.locale === undefined ? {} : { locale: options.brand.locale }),
    ...(options.brand?.style === undefined ? {} : { style: options.brand.style, measure: createDraftTextMeasure(readFileSync(font.file)) }),
  });
  if (captions !== null) {
    writeFileSync(join(draftDir, "captions.ass"), captions);
    mkdirSync(join(draftDir, "fonts"));
    const handFont = isHandFontNeeded(overlays) ? [HAND_FONT.file] : [];
    for (const file of new Set([font.file, ...Object.values(roleFonts).map((chosen) => chosen.file), ...handFont])) copyFileSync(file, join(draftDir, "fonts", basename(file)));
    if (brandFont === null && options.brand?.fonts.body != null) {
      log(`draft: the brand's body font ${options.brand.fonts.body.family} has no TrueType or OpenType file ffmpeg can read; the captions use ${FOOTAGE_DRAFT_FONT.family}.`);
    }
  }
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  report("speech", 0);
  await runFfmpeg("The draft's speech track", buildSpeechArgs(edl, transcript.speech, rawSpeechFile, getSpeechCutOptions(getFootageEdit(film))), { ...aborting, output: rawSpeechFile, onSeconds: (done) => report("speech", done) });
  let declick: DeclickReport | null = null;
  if (declickLevel !== "off") {
    report("declick", 0);
    declick = await declickSpeech({ input: rawSpeechFile, output: declickedFile, words, level: declickLevel, seconds, ...aborting, onSeconds: (done) => report("declick", done) });
    log(describeDeclick(declick));
  }
  if (loudness !== null) {
    report("loudness", 0);
    const outcome = await normalizeLoudness(declickedFile, speechFile, loudness, { ...aborting, onSeconds: (done) => report("loudness", done) });
    log(
      outcome.kind === "silent"
        ? "loudness: the speech track is silent, left as it is."
        : `loudness: the speech track measured ${outcome.measured.toFixed(1)} LUFS, normalized to ${loudness.target} LUFS (true peak ${loudness.truePeak} dBTP).`,
    );
  }
  let musicFile: string | null = null;
  if (music.value.kind === "file") {
    musicFile = join(draftDir, "music.mp3");
    const keyframes = duckingKeyframes(words, getDuckingOptions(film.music));
    report("music", 0);
    const args = buildMusicArgs({ input: music.value.path, seconds, keyframes, output: musicFile });
    await runFfmpeg("The draft's music track", args, { ...aborting, output: musicFile, onSeconds: (done) => report("music", done) });
  } else if (music.value.kind === "not_cached") {
    log(`draft: no music, ${music.value.reason}.`);
  }
  let prepared: PreparedMix | null = null;
  if (mixLoudness !== null) {
    report("mix", 0);
    // The render's mix stage over the draft's tracks (the draft has no sound effects): the same target, ceiling and attempts.
    const mixSource = join(draftDir, "mix.wav");
    const args = buildFilmMixArgs({ speech: { file: speechFile, seconds }, music: musicFile === null ? null : { file: musicFile, seconds }, sfx: [], seconds, output: mixSource });
    await runFfmpeg("The draft's mix", args, { ...aborting, output: mixSource, onSeconds: (done) => report("mix", done) });
    const mixed = await mixFootage(mixLoudness, { mixSource, output: join(draftDir, "mix.m4a") }, { log, ...aborting });
    rmSync(mixSource, { force: true });
    if (!mixed.ok) return mixed;
    prepared = mixed.value;
  }
  report("film", 0);
  // Run in the draft folder: the captions file and the font folder are relative names, so no path needs escaping in the filter graph.
  const args = buildFootageDraftArgs({
    film,
    edl,
    clips: clipFiles,
    speech: speechFile,
    music: musicFile,
    mix: prepared?.audioFile ?? null,
    frame,
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.threads === undefined ? {} : { threads: options.threads }),
    captions: captions === null ? null : "captions.ass",
    ...(overlays.length === 0 ? {} : { overlays }),
    fontsDir: captions === null ? null : "fonts",
    output,
  });
  await runFfmpeg("The footage draft", args, { ...aborting, output, cwd: draftDir, onSeconds: (done) => report("film", done) });
  const measured = await measureDraftLoudness(output, mixLoudness, prepared !== null, aborting);
  if (!measured.ok) return measured;
  const draftLoudness = measured.value;
  if (draftLoudness !== null) {
    log(`loudness: the draft measures ${formatDb(draftLoudness.integrated)} LUFS, true peak ${formatDb(draftLoudness.truePeak)} dBTP.`);
    if (draftLoudness.warning !== null) log(`loudness warning: ${draftLoudness.warning}`);
  }
  report("film", seconds);
  const draft = getFootageDraftFrame(frame, options.width);
  const bytes = statSync(output).size;
  const draftMusic: FootageDraftMusic = music.value.kind === "file" ? "played" : music.value.kind;
  const notes = [captions === null ? "no captions" : `captions in ${font.family}`, draftMusic === "played" ? "music" : draftMusic === "none" ? "no music" : "music not cached"];
  log(`draft: ${output}, ${draft.width}×${draft.height}, ${seconds.toFixed(1)} s, ${bytes} bytes, ${notes.join(", ")}.`);
  return ok({
    output,
    music: draftMusic,
    captionFont: captions === null ? null : font.family,
    seconds,
    width: draft.width,
    height: draft.height,
    bytes,
    declick,
    loudness: draftLoudness,
    mix: prepared?.mix ?? null,
  });
}

/**
 * The written draft's sound measured as `finishFootage` measures the finished film: held to `mixLoudness` when the mix
 * stage made it (a miss fails, a near miss inside `warnTolerance` carries `warning`), reported otherwise; null when
 * the draft is silent.
 */
async function measureDraftLoudness(
  output: string,
  mixLoudness: MixLoudnessTarget | null,
  isMixed: boolean,
  aborting: { signal?: AbortSignal },
): Promise<FootageResult<FinishedLoudness | null>> {
  const measured = await measureLoudness(output, mixLoudness ?? DEFAULT_LOUDNESS, { label: "the footage draft", ...aborting });
  if (measured.kind === "silent") return ok(null);
  const sound = { integrated: measured.measurement.inputI, truePeak: measured.measurement.inputTp };
  const verdict = mixLoudness === null || !isMixed ? { kind: "pass" as const } : getLoudnessVerdict(sound, mixLoudness);
  if (verdict.kind === "fail") {
    return err(`the footage draft ${output} measures ${formatDb(sound.integrated)} LUFS integrated, ${formatDb(sound.truePeak)} dBTP true peak: ${verdict.problems.join("; ")}.`, { kind: "loudness", loudness: sound });
  }
  return ok({ ...sound, warning: verdict.kind === "warn" ? `the footage draft ${output}: ${verdict.warning}` : null });
}

