import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CaptionLayout, LayoutOverride } from "../compose/timeline.js";
import { ok } from "../voice/provider.js";
import type { TimedWord } from "../voice/voiceover.js";
import { getCaptionSpans, getFootageCaptionLayout, phraseChunks } from "./captions.js";
import { getSegmentScales, getSegmentZoomEases } from "./compose.js";
import { getEdlDuration, getSegmentStarts, remapWords, type Edl } from "./edl.js";
import { getFootageEdit, type FootageFilm } from "./film.js";
import { FOOTAGE_FPS, getThreadArgs, type Frame } from "./normalize.js";
import { getFrame, type FootageResult, type FootageRunOptions, type PreparedClip, type TranscribeOutcome } from "./pipeline.js";
import { runFfmpeg } from "./process.js";
import { buildSpeechArgs, getSpeechCutOptions } from "./render.js";

/**
 * A fast draft of a footage film, ffmpeg only (no hyperframes, no browser): the cut at a small width with the film's
 * phrase captions burned in, its zoom cuts (eased as in the render), cross-fades and Ken Burns b-roll drawn as the full render draws them, and
 * the speech track. No loudness pass, music, end card or cover. What an app shows the owner before the paid render.
 */

/** The draft's default width: 540 makes a 540×960 draft of a 9:16 film. */
export const FOOTAGE_DRAFT_WIDTH = 540;

/** The font the draft's captions are drawn with: DejaVu Sans Bold, subset to Latin with every Polish letter, shipped in `fonts/`. */
export const FOOTAGE_DRAFT_FONT = {
  family: "DejaVu Sans",
  file: fileURLToPath(new URL("../../fonts/DejaVuSans-Bold-Latin.ttf", import.meta.url)),
} as const;

/** How far a segment marked `kenburns` zooms when the film's `kenBurnsPercent` is 0, as in the render. */
const HAND_KEN_BURNS_PERCENT = 4;
/** The point a zoom keeps still, as the render's `transform-origin: 50% 42%`. */
const ZOOM_ORIGIN = { x: 0.5, y: 0.42 } as const;
const DRAFT_CRF = 28;
const DRAFT_AUDIO_BITRATE = "128k";

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

/** Caption text as ASS dialogue: override braces and backslashes would be read as tags, line breaks end the line. */
function toAssText(text: string): string {
  return text.replace(/\\/g, "/").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\s+/g, " ").trim();
}

export interface FootageDraftCaptionsInput {
  film: Pick<FootageFilm, "captions">;
  edl: Edl;
  /** The film's words in film time (`remapWords`). */
  words: TimedWord[];
  /** The caption box in the film's frame (`getFootageCaptionLayout`). */
  caption: CaptionLayout;
  /** The film's full frame; the ASS file is laid out in it and libass scales it to the draft. */
  frame: Frame;
  /** The font family the captions are drawn in; default `FOOTAGE_DRAFT_FONT.family`. */
  fontFamily?: string;
}

/**
 * The draft's captions as an ASS subtitle file: the film's phrases (`phraseChunks`) shown for the render's spans
 * (`getCaptionSpans`), white bold text with a dark outline and shadow, centred in the caption box from its top. Null
 * when the film has no captions or nothing is said.
 */
export function buildFootageDraftCaptions(input: FootageDraftCaptionsInput): string | null {
  if (!input.film.captions) return null;
  const chunks = phraseChunks(input.words);
  if (chunks.length === 0) return null;
  const spans = getCaptionSpans(chunks, getEdlDuration(input.edl));
  const { caption, frame } = input;
  const family = (input.fontFamily ?? FOOTAGE_DRAFT_FONT.family).replace(/,/g, " ");
  const outline = Math.max(1, Math.round(caption.fontSize / 16));
  const shadow = Math.max(1, Math.round(caption.fontSize / 25));
  const style = [
    "Caption",
    family,
    caption.fontSize,
    "&H00FFFFFF",
    "&H00FFFFFF",
    "&H8C000000",
    "&H8C000000",
    -1,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    1,
    outline,
    shadow,
    8,
    Math.round(caption.left),
    Math.round(caption.right),
    Math.round(caption.top),
    1,
  ].join(",");
  const events = chunks.map((chunk, index) => {
    const span = spans[index] as { start: number; end: number };
    const text = toAssText(chunk.words.map((word) => word.text).join(" "));
    return `Dialogue: 0,${toAssTime(span.start)},${toAssTime(span.end)},Caption,,0,0,0,,${text}`;
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
    `Style: ${style}`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
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
  /** The film's full frame (the normalized clips' size). */
  frame: Frame;
  /** The draft's width; default 540. */
  width?: number;
  /** The ASS captions file (`buildFootageDraftCaptions`), or null for none. */
  captions: string | null;
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
}

/**
 * How each segment plays in the draft. A `fade` cut lasts the film's `fadeFrames` (clamped to the incoming segment, so
 * the cross-fade never outlasts it) and the outgoing segment runs on under it, as in the render.
 */
export function planFootageDraft(film: Pick<FootageFilm, "edit">, edl: Edl): DraftSegmentPlan[] {
  const edit = getFootageEdit(film);
  const fadeSeconds = r3(edit.fadeFrames / FOOTAGE_FPS);
  const kenBurnsScale = 1 + (edit.kenBurnsPercent > 0 ? edit.kenBurnsPercent : HAND_KEN_BURNS_PERCENT) / 100;
  const scales = getSegmentScales(edl, edit.zoomPercent);
  const eases = getSegmentZoomEases(edl, edit);
  const starts = getSegmentStarts(edl);
  const fades = edl.segments.map((segment, index) => (segment.transition === "fade" && index > 0 ? r3(Math.min(fadeSeconds, segment.end - segment.start)) : 0));
  return edl.segments.map((segment, index) => {
    const scale = scales[index] as number;
    return {
      length: r3(segment.end - segment.start),
      seconds: r3(segment.end - segment.start + (fades[index + 1] ?? 0)),
      start: starts[index] as number,
      fade: fades[index] as number,
      scale,
      endScale: segment.motion === "kenburns" ? r4(scale * kenBurnsScale) : scale,
      startScale: (eases[index] as number) > 0 ? (scales[index - 1] as number) : scale,
      easeFrames: eases[index] as number,
    };
  });
}

/**
 * The filters that zoom a segment's picture and scale it to the draft: a crop for a still zoom, `zoompan` for Ken Burns
 * and for an eased zoom cut (the render's `power1.out`: `1 - (1 - t)^2`).
 */
function buildPictureFilters(plan: DraftSegmentPlan, draft: Frame): string[] {
  const size = `${draft.width}:${draft.height}`;
  const zoompan = (zoom: string): string =>
    `zoompan=z='${zoom}':x='(iw-iw/zoom)*${ZOOM_ORIGIN.x}':y='(ih-ih/zoom)*${ZOOM_ORIGIN.y}':d=1:s=${draft.width}x${draft.height}:fps=${FOOTAGE_FPS}`;
  if (plan.easeFrames > 0) {
    return [zoompan(`${plan.startScale}+(${r4(plan.scale - plan.startScale)})*(1-pow(1-min(on/${plan.easeFrames},1),2))`)];
  }
  if (plan.endScale !== plan.scale) {
    // The zoom runs over the segment's own length, as the render's tween does, and holds through a fade's tail.
    const frames = Math.max(1, Math.round(plan.length * FOOTAGE_FPS));
    const zoom = `${plan.scale}+${r4(plan.endScale - plan.scale)}*min(on/${frames},1)`;
    return [zoompan(zoom)];
  }
  if (plan.scale !== 1) {
    return [`crop=iw/${plan.scale}:ih/${plan.scale}:(iw-iw/${plan.scale})*${ZOOM_ORIGIN.x}:(ih-ih/${plan.scale})*${ZOOM_ORIGIN.y}`, `scale=${size}`];
  }
  return [`scale=${size}`];
}

/**
 * The ffmpeg arguments of the draft: each segment read from its own seek into its clip, zoomed and scaled to the
 * draft's width, joined by `xfade` at `fade` cuts and `concat` at the others, the captions burned in (`ass`), the
 * speech track under it; H.264 yuv420p and AAC with fast start, exactly the cut's length.
 */
export function buildFootageDraftArgs(input: FootageDraftArgsInput): string[] {
  const { edl } = input;
  const draft = getFootageDraftFrame(input.frame, input.width);
  const plans = planFootageDraft(input.film, edl);
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
          `[${joined}][v${index}]concat=n=2:v=1:a=0,settb=1/${FOOTAGE_FPS}[${label}]`,
    );
    joined = label;
  });
  if (input.captions !== null) {
    parts.push(`[${joined}]ass=filename=${input.captions}${input.fontsDir === null ? "" : `:fontsdir=${input.fontsDir}`}[draft]`);
  } else {
    parts.push(`[${joined}]null[draft]`);
  }
  const speechInput = edl.segments.length;
  const seconds = getEdlDuration(edl);
  return [
    "-v",
    "error",
    "-y",
    ...threads.global,
    ...inputs,
    "-i",
    input.speech,
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[draft]",
    "-map",
    `${speechInput}:a`,
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
    "-c:a",
    "aac",
    "-b:a",
    DRAFT_AUDIO_BITRATE,
    "-movflags",
    "+faststart",
    ...threads.output,
    input.output,
  ];
}

export interface RenderFootageDraftOptions extends Pick<FootageRunOptions, "buildDir" | "log" | "signal" | "onProgress"> {
  /** The draft MP4. */
  output: string;
  /** The draft's width; default 540 (540×960 for a 9:16 film). */
  width?: number;
  /** A project's override of the format's caption box (`marketing.json` `layout`), as the render takes it. */
  layout?: LayoutOverride;
  /**
   * ffmpeg's threads for the draft's decoders, filter graph and encoder (`buildFootageDraftArgs`); by default ffmpeg's
   * own choice, which follows the host's cores. Set it from a CPU-limited container's quota.
   */
  threads?: number;
}

export interface FootageDraft {
  output: string;
  /** The draft's length: the cut's. */
  seconds: number;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Makes the draft of a cut film: the speech track, the captions file and the font in `<buildDir>/draft/`, then one
 * ffmpeg run (`buildFootageDraftArgs`). Spends nothing; takes the same clips, transcript and EDL as `renderFootage`.
 */
export async function renderFootageDraft(
  film: FootageFilm,
  clips: PreparedClip[],
  transcript: Extract<TranscribeOutcome, { kind: "ready" }>,
  edl: Edl,
  options: RenderFootageDraftOptions,
): Promise<FootageResult<FootageDraft>> {
  const { log, signal } = options;
  const aborting = signal === undefined ? {} : { signal };
  const seconds = getEdlDuration(edl);
  const draftDir = resolve(options.buildDir, "draft");
  rmSync(draftDir, { recursive: true, force: true });
  mkdirSync(draftDir, { recursive: true });
  const report = (item: string, itemIndex: number, done: number): void =>
    options.onProgress?.({ step: "draft", item, itemIndex, itemCount: 2, done: Math.min(seconds * 2, (itemIndex - 1) * seconds + done), total: seconds * 2 });
  const clipFiles = Object.fromEntries(clips.map((clip) => [clip.clip.id, resolve(clip.file)]));
  const speech = join(draftDir, "speech.mp3");
  const words = remapWords(edl, transcript.words, film.cut.fillers);
  const frame = getFrame(film);
  const captions = buildFootageDraftCaptions({ film, edl, words, caption: getFootageCaptionLayout(film, options.layout ?? {}), frame });
  if (captions !== null) {
    writeFileSync(join(draftDir, "captions.ass"), captions);
    mkdirSync(join(draftDir, "fonts"));
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(draftDir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
  }
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  report("speech", 1, 0);
  await runFfmpeg("The draft's speech track", buildSpeechArgs(edl, transcript.speech, speech, getSpeechCutOptions(getFootageEdit(film))), { ...aborting, output: speech, onSeconds: (done) => report("speech", 1, done) });
  report("film", 2, 0);
  // Run in the draft folder: the captions file and the font folder are relative names, so no path needs escaping in the filter graph.
  const args = buildFootageDraftArgs({
    film,
    edl,
    clips: clipFiles,
    speech,
    frame,
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.threads === undefined ? {} : { threads: options.threads }),
    captions: captions === null ? null : "captions.ass",
    fontsDir: captions === null ? null : "fonts",
    output,
  });
  await runFfmpeg("The footage draft", args, { ...aborting, output, cwd: draftDir, onSeconds: (done) => report("film", 2, done) });
  report("film", 2, seconds);
  const draft = getFootageDraftFrame(frame, options.width);
  const bytes = statSync(output).size;
  log(`draft: ${output}, ${draft.width}×${draft.height}, ${seconds.toFixed(1)} s, ${bytes} bytes${captions === null ? ", no captions" : ""}.`);
  return ok({ output, seconds, width: draft.width, height: draft.height, bytes });
}
