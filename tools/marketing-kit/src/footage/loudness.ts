import { copyFileSync } from "node:fs";

import { z } from "zod";

import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runFfmpeg, runProcess } from "./process.js";

/**
 * The speech track's loudness, measured and normalized in two passes of ffmpeg's `loudnorm` (EBU R128): the first
 * pass measures, the second applies one linear gain from that measurement, so a quiet phone clip is not left quiet
 * and a loud one does not clip. It runs on the speech track before the music is mixed under it, and on the finished
 * film's mix (`FootageFilm.mixLoudness`), so the published file plays at the target whatever the music adds.
 */

export interface LoudnessTarget {
  /** Integrated loudness in LUFS. */
  target: number;
  /** The highest true peak in dBTP. */
  truePeak: number;
}

/** What the platforms play short videos at. */
export const DEFAULT_LOUDNESS: LoudnessTarget = { target: -14, truePeak: -1 };

/** Loudness range target in LU (ffmpeg's default); the gain stays linear, so the speech keeps its dynamics. */
const LOUDNESS_RANGE = 11;

/** Below this the track is silence: there is nothing to normalize. */
const SILENCE_LUFS = -70;

/** The first pass's measurement, as `loudnorm` prints it with `print_format=json`. */
export interface LoudnessMeasurement {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
}

const measurementSchema = z.looseObject({
  input_i: z.string(),
  input_tp: z.string(),
  input_lra: z.string(),
  input_thresh: z.string(),
  target_offset: z.string(),
});

function getLoudnormFilter(target: LoudnessTarget): string {
  return `loudnorm=I=${target.target}:TP=${target.truePeak}:LRA=${LOUDNESS_RANGE}`;
}

/** The first pass: decodes the sound only (a film's picture is skipped), prints the measurement on stderr, writes nothing. */
export function buildLoudnessMeasureArgs(input: string, target: LoudnessTarget): string[] {
  return ["-hide_banner", "-nostats", "-i", input, "-vn", "-af", `${getLoudnormFilter(target)}:print_format=json`, "-f", "null", "-"];
}

/** The measurement from the first pass's stderr (its last JSON block); null when there is none or it is incomplete. */
export function readLoudnessMeasurement(stderr: string): LoudnessMeasurement | null {
  // The block around the last `"input_i"`, found by position (a regex over ffmpeg's whole stderr could backtrack).
  const key = stderr.lastIndexOf('"input_i"');
  const open = key === -1 ? -1 : stderr.lastIndexOf("{", key);
  const close = key === -1 ? -1 : stderr.indexOf("}", key);
  if (open === -1 || close === -1) return null;
  const block = stderr.slice(open, close + 1);
  let json: unknown;
  try {
    json = JSON.parse(block);
  } catch {
    return null;
  }
  const parsed = measurementSchema.safeParse(json);
  if (!parsed.success) return null;
  const value = parsed.data;
  // Silence prints `-inf` loudness and an `inf` offset; both read as infinities, which `isSilent` tells apart.
  const read = (text: string): number => {
    const trimmed = text.trim();
    if (trimmed === "-inf") return -Infinity;
    return trimmed === "inf" || trimmed === "+inf" ? Infinity : Number(trimmed);
  };
  const measurement = {
    inputI: read(value.input_i),
    inputTp: read(value.input_tp),
    inputLra: read(value.input_lra),
    inputThresh: read(value.input_thresh),
    targetOffset: read(value.target_offset),
  };
  return Object.values(measurement).some((number) => Number.isNaN(number)) ? null : measurement;
}

/** True when the measured track is silence, which no gain can bring to the target. */
export function isSilent(measurement: LoudnessMeasurement): boolean {
  return !Number.isFinite(measurement.inputI) || measurement.inputI < SILENCE_LUFS || !Number.isFinite(measurement.inputThresh);
}

/** The second pass's filter: one linear gain from the measurement, resampled back to the film's rate (`loudnorm` runs at 192 kHz). */
export function getLoudnessFilter(measurement: LoudnessMeasurement, target: LoudnessTarget): string {
  const filter = [
    getLoudnormFilter(target),
    `measured_I=${measurement.inputI}`,
    `measured_TP=${measurement.inputTp}`,
    `measured_LRA=${measurement.inputLra}`,
    `measured_thresh=${measurement.inputThresh}`,
    `offset=${measurement.targetOffset}`,
    "linear=true",
  ].join(":");
  return `${filter},aresample=${FOOTAGE_SAMPLE_RATE}`;
}

/** The speech track's second pass, written as an mp3 at the film's rate. */
export function buildLoudnessArgs(options: { input: string; measurement: LoudnessMeasurement; target: LoudnessTarget; output: string }): string[] {
  return [
    "-v",
    "error",
    "-y",
    "-i",
    options.input,
    "-af",
    getLoudnessFilter(options.measurement, options.target),
    "-ar",
    String(FOOTAGE_SAMPLE_RATE),
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    options.output,
  ];
}

export type LoudnessMeasureOutcome = { kind: "measured"; measurement: LoudnessMeasurement } | { kind: "silent" };

/**
 * The first pass over `input`: its measurement, or silent when no gain can bring it to the target. Throws naming
 * `label` (what is measured) when ffmpeg fails, rejects with the signal's reason on abort.
 */
export async function measureLoudness(input: string, target: LoudnessTarget, options: { label: string; signal?: AbortSignal }): Promise<LoudnessMeasureOutcome> {
  const step = `Measuring ${options.label}'s loudness`;
  const measured = await runProcess({ command: "ffmpeg", args: buildLoudnessMeasureArgs(input, target), ...(options.signal === undefined ? {} : { signal: options.signal }) });
  if (measured.kind === "not-started") throw new Error(`${step}: ffmpeg did not start (${measured.error}).`);
  if (measured.code !== 0) throw new Error(`${step}: ffmpeg ended with code ${String(measured.code)}: ${measured.stderr.trim().split("\n").slice(-3).join(" | ")}.`);
  const measurement = readLoudnessMeasurement(measured.stderr);
  if (measurement === null) throw new Error(`${step}: ffmpeg printed no loudnorm measurement for ${input}.`);
  return isSilent(measurement) ? { kind: "silent" } : { kind: "measured", measurement };
}

export type LoudnessOutcome = { kind: "normalized"; measured: number } | { kind: "silent" };

/**
 * Measures `input` and writes it normalized to `output`; a silent track is copied as it is. Throws naming the step
 * when ffmpeg fails, rejects with the signal's reason on abort.
 */
export async function normalizeLoudness(input: string, output: string, target: LoudnessTarget, options: { signal?: AbortSignal; onSeconds?: (seconds: number) => void } = {}): Promise<LoudnessOutcome> {
  const signal = options.signal === undefined ? {} : { signal: options.signal };
  const measured = await measureLoudness(input, target, { label: "the speech track", ...signal });
  if (measured.kind === "silent") {
    copyFileSync(input, output);
    return { kind: "silent" };
  }
  const { measurement } = measured;
  await runFfmpeg("Normalizing the speech track's loudness", buildLoudnessArgs({ input, measurement, target, output }), {
    ...signal,
    output,
    ...(options.onSeconds === undefined ? {} : { onSeconds: options.onSeconds }),
  });
  return { kind: "normalized", measured: measurement.inputI };
}
