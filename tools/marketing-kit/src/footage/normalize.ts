import type { ClipFit, FootageClip } from "./film.js";
import { getTrimmedDuration, type FootageProbe, type HdrKind } from "./probe.js";
import { runFfmpeg, type FfmpegRunOptions } from "./process.js";

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

const TRANSFER_INPUT: Record<HdrKind, string> = { pq: "smpte2084", hlg: "arib-std-b67", "dolby-vision": "arib-std-b67" };

/**
 * HDR to SDR BT.709 on the CPU: to linear light (zscale), Hable tone curve, back to BT.709. A Dolby Vision phone
 * clip is read through its HLG base layer.
 */
export function toneMapFilter(hdr: HdrKind | null, transfer: string | null): string[] {
  if (hdr === null) return [];
  const input = transfer === "smpte2084" || transfer === "arib-std-b67" ? transfer : TRANSFER_INPUT[hdr];
  return [
    `zscale=tin=${input}:pin=bt2020:min=bt2020nc:t=linear:npl=100`,
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=tonemap=hable:desat=0",
    "zscale=t=bt709:m=bt709:r=tv",
    // Back to 8-bit before scaling: the blur fill on float frames crashed ffmpeg 6.1.
    "format=yuv420p",
  ];
}

/** The video filter graph from input 0's picture to `[v]`. */
export function buildVideoFilter(options: { fit: "crop" | "blur"; frame: Frame; hdr: HdrKind | null; transfer: string | null }): string {
  const { width, height } = options.frame;
  const head = [...toneMapFilter(options.hdr, options.transfer), `fps=${FOOTAGE_FPS}`].join(",");
  const cover = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const tail = "setsar=1,format=yuv420p";
  if (options.fit === "crop") return `[0:v]${head},${cover},${tail}[v]`;
  return [
    `[0:v]${head},split=2[bg][fg]`,
    `[bg]scale=${Math.round(width / 4)}:${Math.round(height / 4)}:force_original_aspect_ratio=increase,crop=${Math.round(width / 4)}:${Math.round(height / 4)},boxblur=20:2,scale=${width}:${height},eq=brightness=-0.06[back]`,
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[front]`,
    `[back][front]overlay=(W-w)/2:(H-h)/2,${tail}[v]`,
  ].join(";");
}

export interface NormalizeInput {
  clip: FootageClip;
  /** The local file (a URL's downloaded copy). */
  file: string;
  probe: FootageProbe;
  frame: Frame;
  output: string;
}

/** ffmpeg's arguments for one clip; pure, so the graph is tested without ffmpeg. */
export function buildNormalizeArgs(input: NormalizeInput): string[] {
  const { clip, file, probe, frame, output } = input;
  const duration = getTrimmedDuration(clip, probe);
  const fit = resolveFit(clip.fit, probe, frame);
  const seek = clip.trim.start > 0 ? ["-ss", String(clip.trim.start)] : [];
  const silence = probe.hasAudio ? [] : ["-f", "lavfi", "-i", `anullsrc=r=${FOOTAGE_SAMPLE_RATE}:cl=stereo`];
  return [
    "-v",
    "error",
    "-y",
    ...seek,
    "-i",
    file,
    ...silence,
    "-t",
    duration.toFixed(3),
    "-filter_complex",
    buildVideoFilter({ fit, frame, hdr: probe.hdr, transfer: probe.colorTransfer }),
    "-map",
    "[v]",
    "-map",
    probe.hasAudio ? "0:a:0" : "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
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
    output,
  ];
}

/**
 * Runs ffmpeg for one clip without blocking; throws with the clip's id when it fails (a broken file is not an expected
 * outcome here). An abort removes the partial output and rejects with the signal's reason.
 */
export async function normalizeFootage(input: NormalizeInput, options: Omit<FfmpegRunOptions, "output"> = {}): Promise<void> {
  await runFfmpeg(`Normalizing clip ${input.clip.id} (${input.file})`, buildNormalizeArgs(input), { ...options, output: input.output });
}
