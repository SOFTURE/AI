import { closeSync, openSync, readSync, statSync } from "node:fs";

import { z } from "zod";

import { getSegmentStarts, type Edl } from "./edl.js";
import type { ClipRole } from "./film.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runProcess } from "./process.js";

/**
 * The finished film as a platform or a scheduler takes it: H.264 High in yuv420p, AAC 48 kHz stereo, the `moov` box
 * before the media (`+faststart`, so a streamed URL plays before it is whole), a cover frame, and the facts an app
 * records (bytes, picture, real duration), all read from the written file.
 */

/** The audio bitrate of a re-encoded track. */
const AUDIO_BITRATE = "192k";
/** The quality of a re-encoded picture (x264's constant rate factor; 18 is visually lossless). */
const VIDEO_CRF = 18;
/** How far before the film's end the latest cover frame is taken, so a frame still exists there. */
const COVER_END_MARGIN = 0.1;

/** What ffprobe says about a written film, reduced to what a platform checks. */
export interface FilmFacts {
  bytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  video: { codec: string; profile: string | null; pixelFormat: string | null };
  /** Null for a film without sound. */
  audio: { codec: string; sampleRate: number; channels: number } | null;
}

const streamSchema = z.looseObject({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  profile: z.string().optional(),
  pix_fmt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sample_rate: z.string().optional(),
  channels: z.number().optional(),
});

const factsSchema = z.looseObject({
  streams: z.array(streamSchema).default([]),
  format: z.looseObject({ duration: z.string().optional(), size: z.string().optional() }).optional(),
});

/** ffprobe's JSON (`-show_streams -show_format -of json`) of a film read as its facts; an error names what is missing. */
export function readFilmFacts(json: unknown): { ok: true; facts: FilmFacts } | { ok: false; error: string } {
  const parsed = factsSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "ffprobe printed an unexpected shape" };
  const { streams, format } = parsed.data;
  const video = streams.find((stream) => stream.codec_type === "video");
  if (video?.width === undefined || video.height === undefined) return { ok: false, error: "no video stream" };
  const durationSeconds = Number(format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return { ok: false, error: "no duration" };
  const audio = streams.find((stream) => stream.codec_type === "audio");
  return {
    ok: true,
    facts: {
      bytes: Number(format?.size ?? 0),
      width: video.width,
      height: video.height,
      durationSeconds,
      video: { codec: video.codec_name ?? "unknown", profile: video.profile ?? null, pixelFormat: video.pix_fmt ?? null },
      audio: audio === undefined ? null : { codec: audio.codec_name ?? "unknown", sampleRate: Number(audio.sample_rate ?? 0), channels: audio.channels ?? 0 },
    },
  };
}

/** Runs ffprobe on a written film; an error names the file and the reason. Rejects only on abort. */
export async function probeFilmFacts(path: string, options: { signal?: AbortSignal } = {}): Promise<{ ok: true; facts: FilmFacts } | { ok: false; error: string }> {
  const result = await runProcess({ command: "ffprobe", args: ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], ...options });
  if (result.kind === "not-started") return { ok: false, error: `ffprobe did not start for ${path}: ${result.error}` };
  if (result.code !== 0) return { ok: false, error: `ffprobe cannot read ${path}: ${result.stderr.trim() || `code ${String(result.code)}`}` };
  let json: unknown;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    return { ok: false, error: `ffprobe printed no JSON for ${path}: ${String(error)}` };
  }
  const read = readFilmFacts(json);
  return read.ok ? read : { ok: false, error: `${path}: ${read.error}` };
}

/** True when the picture is already what platforms take: H.264 High, yuv420p. */
export function isPublishableVideo(video: FilmFacts["video"]): boolean {
  return video.codec === "h264" && video.profile === "High" && video.pixelFormat === "yuv420p";
}

/** True when the sound is already what platforms take: AAC at 48 kHz, stereo. */
export function isPublishableAudio(audio: NonNullable<FilmFacts["audio"]>): boolean {
  return audio.codec === "aac" && audio.sampleRate === FOOTAGE_SAMPLE_RATE && audio.channels === 2;
}

/**
 * The final pass: each stream that is already publishable is copied, the other re-encoded, and the `moov` box moved
 * to the front. A film without sound keeps none.
 */
export function buildFinishArgs(input: string, facts: Pick<FilmFacts, "video" | "audio">, output: string): string[] {
  const video = isPublishableVideo(facts.video)
    ? ["-c:v", "copy"]
    : ["-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", String(VIDEO_CRF)];
  const audio =
    facts.audio === null
      ? []
      : isPublishableAudio(facts.audio)
        ? ["-map", "0:a:0", "-c:a", "copy"]
        : ["-map", "0:a:0", "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ar", String(FOOTAGE_SAMPLE_RATE), "-ac", "2"];
  return ["-v", "error", "-y", "-i", input, "-map", "0:v:0", ...video, ...audio, "-movflags", "+faststart", output];
}

/** The types of an MP4's top-level boxes, in file order (`ftyp`, `moov`, `mdat`, …). */
export function readTopLevelBoxes(path: string): string[] {
  const size = statSync(path).size;
  const fd = openSync(path, "r");
  const header = Buffer.alloc(16);
  const types: string[] = [];
  try {
    let offset = 0;
    while (offset + 8 <= size) {
      readSync(fd, header, 0, 16, offset);
      let length = header.readUInt32BE(0);
      types.push(header.toString("latin1", 4, 8));
      // 1: a 64-bit length follows the type; 0: the box runs to the end of the file.
      if (length === 1) length = Number(header.readBigUInt64BE(8));
      if (length === 0) break;
      if (length < 8) throw new Error(`${path}: a box of ${length} bytes at ${offset} is not an MP4 box.`);
      offset += length;
    }
  } finally {
    closeSync(fd);
  }
  return types;
}

/** True when the `moov` box comes before the media (`mdat`), so a player can start before the whole file is in. */
export function isFastStart(boxes: string[]): boolean {
  const moov = boxes.indexOf("moov");
  const mdat = boxes.indexOf("mdat");
  return moov !== -1 && (mdat === -1 || moov < mdat);
}

/** What keeps a finished film from being publishable; empty when nothing does. */
export function findFinishProblems(facts: FilmFacts, boxes: string[]): string[] {
  const problems: string[] = [];
  const { video, audio } = facts;
  if (!isPublishableVideo(video)) problems.push(`the picture is ${video.codec} ${video.profile ?? "-"} ${video.pixelFormat ?? "-"}, not h264 High yuv420p`);
  if (audio !== null && !isPublishableAudio(audio)) problems.push(`the sound is ${audio.codec} ${audio.sampleRate} Hz ${audio.channels} channels, not aac 48000 Hz stereo`);
  if (!isFastStart(boxes)) problems.push("the moov box is not before the media (no fast start)");
  return problems;
}

/** The default cover time: the middle of the first talking segment, or of the first segment when nobody talks. */
export function getDefaultCoverSeconds(edl: Edl, roles: Record<string, ClipRole>): number {
  const starts = getSegmentStarts(edl);
  const index = Math.max(0, edl.segments.findIndex((segment) => roles[segment.clip] === "talk"));
  const segment = edl.segments[index];
  if (segment === undefined) return 0;
  return Math.round(((starts[index] ?? 0) + (segment.end - segment.start) / 2) * 1000) / 1000;
}

/** A cover time inside the film: at most just before its end. */
export function clampCoverSeconds(seconds: number, durationSeconds: number): number {
  return Math.min(Math.max(0, seconds), Math.max(0, Math.round((durationSeconds - COVER_END_MARGIN) * 1000) / 1000));
}

/** One frame of the finished film as a JPG. */
export function buildCoverArgs(film: string, seconds: number, output: string): string[] {
  return ["-v", "error", "-y", "-ss", String(seconds), "-i", film, "-frames:v", "1", "-q:v", "2", output];
}

/** The cover's path next to the film: its name with `.jpg`. */
export function getCoverPath(film: string): string {
  return `${film.replace(/\.[^./\\]+$/, "")}.jpg`;
}
