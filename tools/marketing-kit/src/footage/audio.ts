import { extname } from "node:path";
import { z } from "zod";

import { runFfprobe } from "./probe.js";

/**
 * Music beds: the audio files an app accepts to lay quietly under the voice. One list of accepted types, checked the
 * same way by an app's upload and by the footage pipeline's `music.file`, and an ffprobe reading of what is inside.
 */

/** Accepted music file extensions and the content types a browser or a storage reports for each. */
export const MUSIC_FILE_TYPES: Readonly<Record<string, readonly string[]>> = {
  ".mp3": ["audio/mpeg", "audio/mp3"],
  ".m4a": ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  ".aac": ["audio/aac"],
  ".wav": ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  ".ogg": ["audio/ogg"],
  ".oga": ["audio/ogg"],
  ".opus": ["audio/opus", "audio/ogg"],
  ".flac": ["audio/flac", "audio/x-flac"],
};

export type MusicFileTypeCheck = { ok: true; extension: string | null; contentType: string | null } | { ok: false; error: string };

const ACCEPTED_LIST = Object.keys(MUSIC_FILE_TYPES).join(", ");

function normalizeContentType(contentType: string): string {
  return (contentType.split(";")[0] ?? "").trim().toLowerCase();
}

function getAcceptedTypes(extension: string): readonly string[] | null {
  return Object.hasOwn(MUSIC_FILE_TYPES, extension) ? (MUSIC_FILE_TYPES[extension] ?? null) : null;
}

/**
 * Whether a file is an accepted music bed by its name (or path) and its content type. Give either or both; with both,
 * the content type must be one of the extension's. Parameters (`; codecs=…`) and letter case are ignored.
 */
export function checkMusicFileType(input: { fileName?: string; contentType?: string }): MusicFileTypeCheck {
  const extension = input.fileName === undefined ? null : extname(input.fileName).toLowerCase();
  const contentType = input.contentType === undefined ? null : normalizeContentType(input.contentType);
  if (extension === null && contentType === null) return { ok: false, error: "a music file needs a file name or a content type to check" };
  if (extension !== null) {
    const types = getAcceptedTypes(extension);
    if (types === null) return { ok: false, error: `${input.fileName ?? ""}: not a music file (accepted: ${ACCEPTED_LIST})` };
    if (contentType !== null && !types.includes(contentType)) return { ok: false, error: `${input.fileName ?? ""}: content type ${contentType} does not match ${extension} (expected ${types.join(" or ")})` };
    return { ok: true, extension, contentType };
  }
  const isAccepted = Object.values(MUSIC_FILE_TYPES).some((types) => contentType !== null && types.includes(contentType));
  return isAccepted ? { ok: true, extension: null, contentType } : { ok: false, error: `content type ${contentType ?? ""} is not a music file (accepted: ${ACCEPTED_LIST})` };
}

/** What ffprobe says about a music file: enough to check it, fit it under the cut and store it with the asset. */
export interface AudioProbe {
  /** Seconds. */
  duration: number;
  codec: string;
  /** Hz. */
  sampleRate: number;
  channels: number;
  /** Bits per second; null when the container reports none (Opus in Ogg, FLAC). */
  bitRate: number | null;
}

/** Why a file is not a usable music bed. `unreadable`: ffprobe could not open it (missing, corrupt, not media). */
export type AudioProbeFailure = "no-audio-stream" | "no-duration" | "unexpected-output" | "unreadable";

export type AudioProbeResult = { ok: true; probe: AudioProbe } | { ok: false; reason: AudioProbeFailure; error: string };

const audioStreamSchema = z.looseObject({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  sample_rate: z.string().optional(),
  channels: z.number().optional(),
  bit_rate: z.string().optional(),
  duration: z.string().optional(),
});

const audioProbeSchema = z.looseObject({
  streams: z.array(audioStreamSchema).default([]),
  format: z.looseObject({ duration: z.string().optional(), bit_rate: z.string().optional() }).optional(),
});

function readPositive(value: string | undefined): number | null {
  const number = Number(value);
  return value !== undefined && Number.isFinite(number) && number > 0 ? number : null;
}

/** ffprobe's JSON (`-show_streams -show_format -of json`) read as a music bed: the first audio stream, cover art ignored. */
export function readAudioProbe(json: unknown): AudioProbeResult {
  const parsed = audioProbeSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "unexpected-output", error: "ffprobe printed an unexpected shape" };
  const { streams, format } = parsed.data;
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (audio === undefined) return { ok: false, reason: "no-audio-stream", error: "no audio stream" };
  const duration = readPositive(format?.duration) ?? readPositive(audio.duration);
  if (duration === null) return { ok: false, reason: "no-duration", error: "no duration" };
  return {
    ok: true,
    probe: {
      duration,
      codec: audio.codec_name ?? "unknown",
      sampleRate: readPositive(audio.sample_rate) ?? 0,
      channels: audio.channels ?? 0,
      bitRate: readPositive(audio.bit_rate) ?? readPositive(format?.bit_rate),
    },
  };
}

/** Probes one music file (or URL) with ffprobe; a failure carries its reason and names the file. Rejects only on abort. */
export async function probeAudio(path: string, options: { signal?: AbortSignal } = {}): Promise<AudioProbeResult> {
  const output = await runFfprobe(path, options);
  if (!output.ok) return { ok: false, reason: "unreadable", error: output.error };
  const read = readAudioProbe(output.json);
  return read.ok ? read : { ...read, error: `${path}: ${read.error}` };
}

/** One line about a probed music file, for the log. */
export function describeAudioProbe(probe: AudioProbe): string {
  const parts = [probe.codec, `${probe.duration.toFixed(1)} s`, `${String(probe.sampleRate)} Hz`, probe.channels === 1 ? "mono" : `${String(probe.channels)} channels`];
  if (probe.bitRate !== null) parts.push(`${String(Math.round(probe.bitRate / 1000))} kb/s`);
  return parts.join(", ");
}
