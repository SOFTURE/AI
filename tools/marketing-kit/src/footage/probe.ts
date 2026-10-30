import { z } from "zod";

import type { FootageClip } from "./film.js";
import { runProcess } from "./process.js";

/**
 * What ffprobe says about a clip, reduced to what the footage pipeline needs: its length, its picture as it is
 * stored and as it is shown (a phone stores portrait video as landscape plus a rotation), whether it is HDR and
 * whether it has sound.
 */

/** `pq` and `hlg` by transfer; `dolby-vision` when the stream carries a Dolby Vision configuration (iPhone: HLG base). */
export type HdrKind = "pq" | "hlg" | "dolby-vision";

export interface FootageProbe {
  /** Seconds. */
  duration: number;
  /** The stored picture. */
  width: number;
  height: number;
  /** Counter-clockwise degrees the player turns the picture: 0, 90, 180 or 270. */
  rotation: number;
  /** The picture as shown, the rotation applied. */
  displayWidth: number;
  displayHeight: number;
  codec: string;
  pixelFormat: string | null;
  colorTransfer: string | null;
  hdr: HdrKind | null;
  hasAudio: boolean;
}

export type ProbeResult = { ok: true; probe: FootageProbe } | { ok: false; error: string };

const sideDataSchema = z.looseObject({ side_data_type: z.string().optional(), rotation: z.number().optional() });

const streamSchema = z.looseObject({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  pix_fmt: z.string().optional(),
  color_transfer: z.string().optional(),
  duration: z.string().optional(),
  side_data_list: z.array(sideDataSchema).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const probeSchema = z.looseObject({
  streams: z.array(streamSchema).default([]),
  format: z.looseObject({ duration: z.string().optional() }).optional(),
});

/** Turns any rotation (`-90`, `270`, `450`) into 0, 90, 180 or 270. */
export function normalizeRotation(degrees: number): number {
  return (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
}

function readRotation(stream: z.infer<typeof streamSchema>): number {
  const matrix = stream.side_data_list?.find((entry) => entry.rotation !== undefined);
  if (matrix?.rotation !== undefined) return normalizeRotation(matrix.rotation);
  const tag = Number(stream.tags?.rotate);
  // The `rotate` tag of older muxers is clockwise; the display matrix is counter-clockwise.
  return Number.isFinite(tag) ? normalizeRotation(-tag) : 0;
}

function readHdr(stream: z.infer<typeof streamSchema>): HdrKind | null {
  const isDolbyVision = stream.side_data_list?.some((entry) => /dovi|dolby vision/i.test(entry.side_data_type ?? "")) ?? false;
  if (isDolbyVision) return "dolby-vision";
  if (stream.color_transfer === "smpte2084") return "pq";
  if (stream.color_transfer === "arib-std-b67") return "hlg";
  return null;
}

/** ffprobe's JSON (`-show_streams -show_format -of json`) read as a footage probe; an error names what is missing. */
export function readFootageProbe(json: unknown): ProbeResult {
  const parsed = probeSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "ffprobe printed an unexpected shape" };
  const { streams, format } = parsed.data;
  const video = streams.find((stream) => stream.codec_type === "video");
  if (video === undefined || video.width === undefined || video.height === undefined) return { ok: false, error: "no video stream" };
  const duration = Number(format?.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0) return { ok: false, error: "no duration" };
  const rotation = readRotation(video);
  const isTurned = rotation === 90 || rotation === 270;
  return {
    ok: true,
    probe: {
      duration,
      width: video.width,
      height: video.height,
      rotation,
      displayWidth: isTurned ? video.height : video.width,
      displayHeight: isTurned ? video.width : video.height,
      codec: video.codec_name ?? "unknown",
      pixelFormat: video.pix_fmt ?? null,
      colorTransfer: video.color_transfer ?? null,
      hdr: readHdr(video),
      hasAudio: streams.some((stream) => stream.codec_type === "audio"),
    },
  };
}

/** Runs ffprobe on one file (or URL) without blocking; an error names the file and the reason. Rejects only on abort. */
export async function probeFile(path: string, options: { signal?: AbortSignal } = {}): Promise<ProbeResult> {
  const result = await runProcess({ command: "ffprobe", args: ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], ...options });
  if (result.kind === "not-started") return { ok: false, error: `ffprobe did not start for ${path}: ${result.error}` };
  if (result.code !== 0) return { ok: false, error: `ffprobe cannot read ${path}: ${result.stderr.trim() || `code ${String(result.code)}`}` };
  let json: unknown;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    return { ok: false, error: `ffprobe printed no JSON for ${path}: ${String(error)}` };
  }
  const read = readFootageProbe(json);
  return read.ok ? read : { ok: false, error: `${path}: ${read.error}` };
}

/** Shortest clip part the cut can use, in seconds. */
export const MIN_CLIP_SECONDS = 0.3;

/** The clip's length after its trim. */
export function getTrimmedDuration(clip: Pick<FootageClip, "trim">, probe: Pick<FootageProbe, "duration">): number {
  const end = clip.trim.end === null ? probe.duration : Math.min(clip.trim.end, probe.duration);
  return Math.max(0, end - clip.trim.start);
}

/** What makes a probed clip unusable before anything is paid for: a trim outside it, or too little left. */
export function findFootageProblems(clip: FootageClip, probe: FootageProbe): string[] {
  const problems: string[] = [];
  if (clip.trim.start >= probe.duration) problems.push(`trim.start ${clip.trim.start} s is past the clip's end (${probe.duration.toFixed(2)} s)`);
  if (clip.trim.end !== null && clip.trim.end <= clip.trim.start) problems.push(`trim.end ${clip.trim.end} s is not after trim.start ${clip.trim.start} s`);
  if (problems.length === 0 && getTrimmedDuration(clip, probe) < MIN_CLIP_SECONDS) problems.push(`shorter than ${MIN_CLIP_SECONDS} s after the trim`);
  return problems;
}

export interface ProbedClip {
  clip: FootageClip;
  /** The local file the probe read (the downloaded copy for a URL). */
  file: string;
  probe: FootageProbe;
}

/**
 * Probes every clip and reports every problem at once, before anything is paid for. `files` maps a clip id to its
 * local file (a URL's downloaded copy).
 */
export async function probeFootage(
  clips: FootageClip[],
  files: Record<string, string>,
  options: { signal?: AbortSignal } = {},
): Promise<{ ok: true; clips: ProbedClip[] } | { ok: false; errors: string[] }> {
  const probed: ProbedClip[] = [];
  const errors: string[] = [];
  for (const clip of clips) {
    const file = files[clip.id] ?? clip.source;
    const result = await probeFile(file, options);
    if (!result.ok) {
      errors.push(`clip "${clip.id}": ${result.error}`);
      continue;
    }
    for (const problem of findFootageProblems(clip, result.probe)) errors.push(`clip "${clip.id}": ${problem}`);
    probed.push({ clip, file, probe: result.probe });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, clips: probed };
}

/** One line about a probed clip, for the log. */
export function describeProbe(clip: FootageClip, probe: FootageProbe): string {
  const parts = [`${probe.displayWidth}×${probe.displayHeight}`, probe.codec, `${probe.duration.toFixed(1)} s`];
  if (probe.rotation !== 0) parts.push(`rotated ${probe.rotation}°`);
  if (probe.hdr !== null) parts.push(`HDR (${probe.hdr}), tone-mapped to SDR`);
  if (!probe.hasAudio) parts.push("no sound");
  return `clip ${clip.id} (${clip.role}): ${parts.join(", ")}`;
}
