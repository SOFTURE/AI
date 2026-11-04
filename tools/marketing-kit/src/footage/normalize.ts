import { dirname, resolve } from "node:path";

import type { ClipFit, FootageClip } from "./film.js";
import { getTrimmedDuration, type FootageProbe, type HdrKind } from "./probe.js";
import { runFfmpeg, type FfmpegRunOptions } from "./process.js";
import { ensureToneMapLut, getToneMapTransfer, HABLE_STAGES } from "./tonemap-lut.js";

/**
 * One intermediate format for every clip, so the composition can cut between them freely: the film's frame at
 * 30 fps, upright (ffmpeg applies the stored rotation while decoding), SDR BT.709 (HDR tone-mapped), filled by a crop
 * or a blurred copy, a keyframe every half second (the renderer seeks into each segment), and 48 kHz stereo AAC
 * (silence when the clip has no sound), so the speech track can be cut from any clip alike.
 */

export const FOOTAGE_FPS = 30;
export const FOOTAGE_SAMPLE_RATE = 48_000;
/** Within this difference of aspect ratios `auto` crops; beyond it, it fills with a blurred copy. */
const CROP_ASPECT_TOLERANCE = 0.15;

export interface Frame {
  width: number;
  height: number;
}

/** The fit `auto` resolves to for this picture in this frame. */
export function resolveFit(fit: ClipFit, probe: Pick<FootageProbe, "displayWidth" | "displayHeight">, frame: Frame): "crop" | "blur" {
  if (fit !== "auto") return fit;
  const clipAspect = probe.displayWidth / probe.displayHeight;
  const frameAspect = frame.width / frame.height;
  return Math.abs(clipAspect - frameAspect) / frameAspect <= CROP_ASPECT_TOLERANCE ? "crop" : "blur";
}

/**
 * HDR to SDR BT.709 on the CPU. A Dolby Vision phone clip is read through its HLG base layer. With `lut` (the file
 * name of the transfer's tone map LUT, `ensureToneMapLut`, in the folder ffmpeg runs in): to 16-bit R'G'B', the LUT
 * to linear BT.709 light, the BT.709 transfer and matrix, about half the cost; colours outside BT.709 are clipped per
 * RGB channel. Without it: to linear light (zscale), the Hable curve in float, back to BT.709, the same curve the LUT
 * is made from; colours outside BT.709 are clamped in YUV.
 */
export function toneMapFilter(hdr: HdrKind | null, transfer: string | null, lut?: string): string[] {
  if (hdr === null) return [];
  if (lut !== undefined) {
    return ["zscale=min=bt2020nc:m=gbr:r=full", "format=gbrp16le", `lut3d=file=${lut}:interp=tetrahedral`, "zscale=tin=linear:pin=bt709:t=bt709:p=bt709:m=bt709:r=tv", "format=yuv420p"];
  }
  return [
    `zscale=tin=${getToneMapTransfer(hdr, transfer)}:pin=bt2020:min=bt2020nc:t=linear:npl=100`,
    ...HABLE_STAGES,
    "zscale=t=bt709:m=bt709:r=tv",
    // Back to 8-bit before scaling: the blur fill on float frames crashed ffmpeg 6.1.
    "format=yuv420p",
  ];
}

/**
 * The video filter graph from input 0's picture to `[v]`. Every stage runs on as little as it can: frames are
 * dropped to 30 fps first, then the picture is scaled to the frame (crop: covered and cropped to it; blur: fitted
 * inside it), and only then tone-mapped, so the tone map of an HDR clip works on frame-sized pictures instead of
 * the source's (a 4K phone clip has 4x the pixels of a 1080x1920 frame). The blur's background is made from the
 * fitted picture. `toneMapLut` as in `toneMapFilter`.
 */
export function buildVideoFilter(options: { fit: "crop" | "blur"; frame: Frame; hdr: HdrKind | null; transfer: string | null; toneMapLut?: string }): string {
  const { width, height } = options.frame;
  const toneMap = toneMapFilter(options.hdr, options.transfer, options.toneMapLut);
  const tail = "setsar=1,format=yuv420p";
  if (options.fit === "crop") {
    const cover = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    return `[0:v]${[`fps=${FOOTAGE_FPS}`, cover, ...toneMap, tail].join(",")}[v]`;
  }
  // Even sizes: zscale refuses odd ones in 4:2:0.
  const fitted = `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const backWidth = Math.round(width / 4);
  const backHeight = Math.round(height / 4);
  return [
    `[0:v]${[`fps=${FOOTAGE_FPS}`, fitted, ...toneMap, "split=2[bg][fg]"].join(",")}`,
    `[bg]scale=${backWidth}:${backHeight}:force_original_aspect_ratio=increase,crop=${backWidth}:${backHeight},boxblur=20:2,scale=${width}:${height},eq=brightness=-0.06[back]`,
    `[back][fg]overlay=(W-w)/2:(H-h)/2,${tail}[v]`,
  ].join(";");
}

/** x264's presets, fastest first. */
export const X264_PRESETS = ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"] as const;
export type X264Preset = (typeof X264_PRESETS)[number];
const DEFAULT_NORMALIZE_PRESET: X264Preset = "veryfast";

/**
 * How the intermediate clips are encoded. A small worker can trade file size for speed: `preset` (default
 * `veryfast`; `superfast` or `ultrafast` encode faster into bigger files), `threads` (ffmpeg's encoder and filter
 * threads; by default ffmpeg's own choice, which follows the host's cores, not a container's CPU quota).
 */
export interface NormalizeEncoder {
  preset?: X264Preset;
  threads?: number;
}

export interface NormalizeInput {
  clip: FootageClip;
  /** The local file (a URL's downloaded copy). */
  file: string;
  probe: FootageProbe;
  frame: Frame;
  output: string;
  encoder?: NormalizeEncoder;
  /**
   * The tone map LUT's file name for an HDR clip, resolved in the folder ffmpeg runs in (`toneMapFilter`). Without it
   * `buildNormalizeArgs` uses the float chain; `normalizeFootage` makes the LUT next to the output and uses it.
   */
  toneMapLut?: string;
}

/**
 * The thread arguments: global filter threads (before the inputs) and encoder threads (before the output; the same
 * flag before an input sets that input's decoder threads). Throws, naming `option`, when `threads` is not a positive
 * whole number.
 */
export function getThreadArgs(threads: number | undefined, option: string): { global: string[]; output: string[] } {
  if (threads === undefined) return { global: [], output: [] };
  if (!Number.isInteger(threads) || threads < 1) throw new Error(`${option} must be a positive whole number, got ${threads}.`);
  return { global: ["-filter_complex_threads", String(threads)], output: ["-threads", String(threads)] };
}

/** ffmpeg's arguments for one clip; pure, so the graph is tested without ffmpeg. Throws on an invalid `encoder.threads`. */
export function buildNormalizeArgs(input: NormalizeInput): string[] {
  const { clip, file, probe, frame, output } = input;
  const duration = getTrimmedDuration(clip, probe);
  const fit = resolveFit(clip.fit, probe, frame);
  const seek = clip.trim.start > 0 ? ["-ss", String(clip.trim.start)] : [];
  const threads = getThreadArgs(input.encoder?.threads, "normalize.threads");
  const silence = probe.hasAudio ? [] : ["-f", "lavfi", "-i", `anullsrc=r=${FOOTAGE_SAMPLE_RATE}:cl=stereo`];
  return [
    "-v",
    "error",
    "-y",
    ...threads.global,
    ...seek,
    "-i",
    file,
    ...silence,
    "-t",
    duration.toFixed(3),
    "-filter_complex",
    buildVideoFilter({ fit, frame, hdr: probe.hdr, transfer: probe.colorTransfer, ...(input.toneMapLut === undefined ? {} : { toneMapLut: input.toneMapLut }) }),
    "-map",
    "[v]",
    "-map",
    probe.hasAudio ? "0:a:0" : "1:a",
    "-c:v",
    "libx264",
    "-preset",
    input.encoder?.preset ?? DEFAULT_NORMALIZE_PRESET,
    "-crf",
    "18",
    "-g",
    String(FOOTAGE_FPS / 2),
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    String(FOOTAGE_SAMPLE_RATE),
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    ...threads.output,
    output,
  ];
}

/**
 * Runs ffmpeg for one clip without blocking; throws with the clip's id when it fails (a broken file is not an expected
 * outcome here). An HDR clip without `toneMapLut` gets its transfer's LUT made once in the output's folder, and ffmpeg
 * runs there so the graph names the LUT without a path. An abort removes the partial output and rejects with the
 * signal's reason.
 */
export async function normalizeFootage(input: NormalizeInput, options: Omit<FfmpegRunOptions, "output" | "cwd"> = {}): Promise<void> {
  const step = `Normalizing clip ${input.clip.id} (${input.file})`;
  const output = resolve(input.output);
  const { hdr, colorTransfer } = input.probe;
  if (hdr === null || input.toneMapLut !== undefined) {
    await runFfmpeg(step, buildNormalizeArgs(input), { ...options, output });
    return;
  }
  const dir = dirname(output);
  const toneMapLut = await ensureToneMapLut(getToneMapTransfer(hdr, colorTransfer), dir, options.signal === undefined ? {} : { signal: options.signal });
  const args = buildNormalizeArgs({ ...input, file: resolve(input.file), output, toneMapLut });
  await runFfmpeg(step, args, { ...options, output, cwd: dir });
}
