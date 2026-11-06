import { copyFileSync } from "node:fs";

import { z } from "zod";

import { getAudioCodecArgs } from "./clip-sound.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runFfmpeg, runProcess } from "./process.js";
import { FINISHED_AUDIO_BITRATE } from "./publish.js";

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

/**
 * The first pass: decodes the sound only (a film's picture is skipped), prints the measurement on stderr, writes
 * nothing. With `filter`, what is measured is the sound through it (the mix stage's uncompressed probes).
 */
export function buildLoudnessMeasureArgs(input: string, target: LoudnessTarget, filter?: string): string[] {
  const measure = `${getLoudnormFilter(target)}:print_format=json`;
  return ["-hide_banner", "-nostats", "-i", input, "-vn", "-af", filter === undefined ? measure : `${filter},${measure}`, "-f", "null", "-"];
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

/** The speech track's second pass at the film's rate, encoded by the output's extension (`.wav` lossless float). */
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
    ...getAudioCodecArgs(options.output),
    options.output,
  ];
}

export type LoudnessMeasureOutcome = { kind: "measured"; measurement: LoudnessMeasurement } | { kind: "silent" };

/**
 * The first pass over `input` (through `filter` when given): its measurement, or silent when no gain can bring it to the target. Throws naming
 * `label` (what is measured) when ffmpeg fails, rejects with the signal's reason on abort.
 */
export async function measureLoudness(input: string, target: LoudnessTarget, options: { label: string; signal?: AbortSignal; filter?: string }): Promise<LoudnessMeasureOutcome> {
  const step = `Measuring ${options.label}'s loudness`;
  const measured = await runProcess({ command: "ffmpeg", args: buildLoudnessMeasureArgs(input, target, options.filter), ...(options.signal === undefined ? {} : { signal: options.signal }) });
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

/** The film's mix as measured on an encoded file: integrated loudness in LUFS, true peak in dBTP. */
export interface MixLoudness {
  integrated: number;
  truePeak: number;
}

/** How far from `LoudnessTarget.target` the finished mix may land, in LU, unless `MixLoudnessTarget.tolerance` says. */
export const MIX_LOUDNESS_TOLERANCE = 1;

/**
 * The finished film's mix target. `keep: "loudness"` (the default) brings the mix to `target` with one gain measured on
 * it, so the speech moves with whatever the music adds; `keep: "speech"` applies no gain while the mix measures inside
 * `target ± tolerance` and otherwise only the smallest gain to that window, so the speech (already at the film's
 * `loudness`) keeps its level whatever the music volume. Either way a true peak limiter is the last step.
 */
export interface MixLoudnessTarget extends LoudnessTarget {
  /** How far from `target` the mix may land, in LU. Absent: `MIX_LOUDNESS_TOLERANCE`. */
  tolerance?: number;
  /** What the mix's gain keeps: the mix at the target (absent, `"loudness"`) or the speech's level (`"speech"`). */
  keep?: "loudness" | "speech";
  /** How many times the mix is encoded and measured before the film fails. Absent: `MIX_ATTEMPTS`. */
  attempts?: number;
  /**
   * A near-miss band in LU, at least `tolerance`: a finished mix outside `target ± tolerance` but inside
   * `target ± warnTolerance`, under the true peak limit, finishes with a warning instead of failing. Absent: none.
   */
  warnTolerance?: number;
  /**
   * The finished sound's AAC bitrate in kbps (192 to 512), the film's only lossy audio encode (issue #1139). Absent:
   * `FINISHED_AUDIO_BITRATE` (192).
   */
  audioBitrateKbps?: number;
}

/** The lowest and highest AAC bitrate `MixLoudnessTarget.audioBitrateKbps` takes, in kbps. */
export const AUDIO_BITRATE_RANGE_KBPS = { min: 192, max: 512 } as const;

/** A gain to the window's edge aims this far inside it (at most half the tolerance), so the encode's drift stays in. */
const MIX_EDGE_MARGIN = 0.2;
/** The limiter's ceiling sits this far under the true peak limit: AAC adds inter-sample overshoot after it. */
export const MIX_ENCODE_HEADROOM = 1;
/** How many times the mix is encoded and measured before the film fails, unless `MixLoudnessTarget.attempts` says. */
export const MIX_ATTEMPTS = 4;
/** What a retry lowers the ceiling by on top of the measured true peak excess, in dB. */
const MIX_RETRY_MARGIN = 0.3;
/** With `keep: "speech"`, a probe inside the window shrunk by this much needs no gain (the encode moves a mix about this much), in LU. */
const MIX_MET_MARGIN = 0.1;
/** With `keep: "speech"`, a mix that misses the window is aimed this far inside its edge (at most half the tolerance), in LU. */
export const MIX_AIM_EDGE_MARGIN = 0.45;
/** How close to its aim a probe must land, in LU: the plain target's window, and how far inside the edge keep speech aims. */
export const MIX_GAIN_PRECISION = 0.15;
/** How many uncompressed passes one solve of the gain may take. */
export const MIX_GAIN_PROBES = 6;
/** The largest gain a probe tries, either way, in dB. */
const MIX_GAIN_LIMIT = 30;
/** Below this loudness change per dB of gain the slope is not trusted (the limiter takes it back): a probe steps by its miss. */
const MIX_MIN_SLOPE = 0.2;
/**
 * The mix is low-passed here after the limiter, and the AAC encoder cuts here too: the limiter's fast gain moves leave
 * high frequencies on every transient that AAC turns into inter-sample overshoot (up to 3.4 dB on clicky speech,
 * issue #1124); without them it stays within about 1 dB.
 */
export const MIX_LOWPASS_HZ = 16000;
/** `alimiter`'s lowest ceiling (its `limit` of 0.0625), in dB. */
const LIMITER_FLOOR = -24;
/** The limiter runs at 4x the film's rate, so it holds the true peak rather than the sample peak. */
const LIMITER_RATE = FOOTAGE_SAMPLE_RATE * 4;

/** One try at the mix's last stage: a linear gain, then a true peak limiter at the ceiling. */
export interface MixAttempt {
  gainDb: number;
  ceilingDbtp: number;
}

/** One measurement of the mix through an attempt: uncompressed (a probe of the gain) or encoded (a try). */
export interface MixTry {
  attempt: MixAttempt;
  measured: MixLoudness;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** The window's half width around the mix target, in LU. */
export function getMixTolerance(target: MixLoudnessTarget): number {
  return target.tolerance ?? MIX_LOUDNESS_TOLERANCE;
}

/** How many encodes the mix stage may take. */
export function getMixAttempts(target: MixLoudnessTarget): number {
  return target.attempts ?? MIX_ATTEMPTS;
}

/**
 * The gain a mix measuring `integrated` LUFS needs before any limiter: to the target in the default mode; with
 * `keep: "speech"` none inside `target ± tolerance`, else to the nearest edge (aimed a little inside, see
 * `MIX_EDGE_MARGIN`). The first probe of the gain starts here.
 */
export function getMixGain(integrated: number, target: MixLoudnessTarget): number {
  if (target.keep !== "speech") return roundTo(target.target - integrated, 2);
  const tolerance = getMixTolerance(target);
  const inside = tolerance - Math.min(MIX_EDGE_MARGIN, tolerance / 2);
  if (integrated < target.target - tolerance) return roundTo(target.target - inside - integrated, 2);
  if (integrated > target.target + tolerance) return roundTo(target.target + inside - integrated, 2);
  return 0;
}

/** The first ceiling: one encode's headroom under the true peak limit, never under the limiter's floor. */
export function getFirstMixCeiling(target: MixLoudnessTarget): number {
  return Math.max(LIMITER_FLOOR, roundTo(target.truePeak - MIX_ENCODE_HEADROOM, 2));
}

/**
 * The ceiling for the next encode: lowered by the encode's true peak excess plus a margin when it broke the limit,
 * else kept. The excess is the codec's (the gain does not move it), so the ceiling never moves with the loudness.
 */
export function getNextMixCeiling(ceilingDbtp: number, measured: MixLoudness, target: MixLoudnessTarget): number {
  const excess = measured.truePeak - target.truePeak;
  return excess > 0 ? Math.max(LIMITER_FLOOR, roundTo(ceilingDbtp - excess - MIX_RETRY_MARGIN, 2)) : ceilingDbtp;
}

/** Where a probe of the gain should land a mix that measures `integrated` LUFS, and whether it already does. */
export interface MixAim {
  aim: number;
  isMet: boolean;
}

/**
 * The gain's aim for a mix at `integrated` LUFS: in the default mode the target (met within `MIX_GAIN_PRECISION`);
 * with `keep: "speech"` met (no gain moves it) inside the window shrunk by `MIX_MET_MARGIN`, else
 * `MIX_AIM_EDGE_MARGIN` inside the edge it misses.
 */
export function getMixAim(integrated: number, target: MixLoudnessTarget): MixAim {
  if (target.keep !== "speech") return { aim: target.target, isMet: Math.abs(integrated - target.target) <= MIX_GAIN_PRECISION };
  const tolerance = getMixTolerance(target);
  const met = tolerance - Math.min(MIX_MET_MARGIN, tolerance / 2);
  const aim = tolerance - Math.min(MIX_AIM_EDGE_MARGIN, tolerance / 2);
  if (integrated < target.target - met) return { aim: roundTo(target.target - aim, 2), isMet: false };
  if (integrated > target.target + met) return { aim: roundTo(target.target + aim, 2), isMet: false };
  return { aim: integrated, isMet: true };
}

/**
 * The next gain to probe at a fixed ceiling, from the probes so far (oldest first) and `shift` (what the encode adds
 * to a probe's loudness, 0 before the first encode): a secant step through the last two probes, or a step by the
 * miss when there is one probe or the slope is flat or falling (the limiter takes back what the gain adds, so the
 * loudness is not monotone in the gain on clicky speech). Null when the last probe meets its aim, or the step would
 * repeat a gain already probed.
 */
export function getNextGainProbe(probes: readonly MixTry[], target: MixLoudnessTarget, shift = 0): number | null {
  const last = probes.at(-1);
  if (last === undefined) throw new Error("getNextGainProbe: no probe of the mix to correct.");
  const { aim, isMet } = getMixAim(last.measured.integrated + shift, target);
  if (isMet) return null;
  const miss = aim - shift - last.measured.integrated;
  const before = probes.at(-2);
  const slope = before === undefined || before.attempt.gainDb === last.attempt.gainDb ? 0 : (last.measured.integrated - before.measured.integrated) / (last.attempt.gainDb - before.attempt.gainDb);
  const step = slope > MIX_MIN_SLOPE ? miss / slope : miss;
  const gainDb = roundTo(Math.min(MIX_GAIN_LIMIT, Math.max(-MIX_GAIN_LIMIT, last.attempt.gainDb + step)), 2);
  return probes.some((probe) => probe.attempt.gainDb === gainDb) ? null : gainDb;
}

/** The probe closest to its aim: the one the encode uses. */
export function getBestGainProbe(probes: readonly MixTry[], target: MixLoudnessTarget, shift = 0): MixTry {
  const score = (probe: MixTry): number => {
    const { aim, isMet } = getMixAim(probe.measured.integrated + shift, target);
    return isMet ? 0 : Math.abs(aim - shift - probe.measured.integrated);
  };
  const first = probes[0];
  if (first === undefined) throw new Error("getBestGainProbe: no probe of the mix.");
  return probes.reduce((best, probe) => (score(probe) < score(best) ? probe : best), first);
}

/**
 * The gain at `ceilingDbtp` found by measuring the uncompressed chain (`measure`, one decode of the sound, no encode)
 * from `startGainDb`, at most `MIX_GAIN_PROBES` times: the best probe, with every probe it took.
 */
export async function solveMixGain(options: {
  ceilingDbtp: number;
  startGainDb: number;
  target: MixLoudnessTarget;
  shift: number;
  measure: (attempt: MixAttempt) => Promise<MixLoudness>;
}): Promise<{ best: MixTry; probes: MixTry[] }> {
  const probes: MixTry[] = [];
  let gainDb: number | null = options.startGainDb;
  while (gainDb !== null && probes.length < MIX_GAIN_PROBES) {
    const attempt = { gainDb, ceilingDbtp: options.ceilingDbtp };
    probes.push({ attempt, measured: await options.measure(attempt) });
    gainDb = getNextGainProbe(probes, options.target, options.shift);
  }
  return { best: getBestGainProbe(probes, options.target, options.shift), probes };
}

/**
 * The mix's last stage: one linear gain, then a lookahead limiter at 4x the film's rate (its delay compensated, so
 * the sound stays in sync with the picture; no auto level), back to the film's rate, then a low-pass at
 * `MIX_LOWPASS_HZ` that keeps AAC's overshoot small.
 */
export function getMixFilter(attempt: MixAttempt): string {
  const limit = roundTo(10 ** (attempt.ceilingDbtp / 20), 5);
  return [`volume=${attempt.gainDb}dB`, `aresample=${LIMITER_RATE}`, `alimiter=limit=${limit}:level=false:latency=true`, `aresample=${FOOTAGE_SAMPLE_RATE}`, `lowpass=f=${MIX_LOWPASS_HZ}`].join(",");
}

/**
 * The mix's sound on its own through `filter`, encoded as the finished film carries it (AAC at `bitrateKbps`, default
 * `FINISHED_AUDIO_BITRATE`, cut at `MIX_LOWPASS_HZ`, 48 kHz, stereo).
 */
export function buildMixArgs(options: { input: string; filter: string; output: string; bitrateKbps?: number }): string[] {
  return [
    "-v",
    "error",
    "-y",
    "-i",
    options.input,
    "-vn",
    "-map",
    "0:a:0",
    "-af",
    options.filter,
    "-c:a",
    "aac",
    "-b:a",
    options.bitrateKbps === undefined ? FINISHED_AUDIO_BITRATE : `${String(options.bitrateKbps)}k`,
    "-cutoff",
    String(MIX_LOWPASS_HZ),
    "-ar",
    String(FOOTAGE_SAMPLE_RATE),
    "-ac",
    "2",
    options.output,
  ];
}

/** How a measured mix stands against its target: inside it, a near miss inside `warnTolerance`, or outside. */
export type LoudnessVerdict = { kind: "pass" } | { kind: "warn"; warning: string } | { kind: "fail"; problems: string[] };

/**
 * The verdict on a measured mix: `pass` inside `target ± tolerance` and at most `truePeak`; `warn` (a sentence with
 * both values) when only the integrated loudness misses, by at most `warnTolerance`; else `fail` with the problems.
 * The true peak limit has no near-miss band.
 */
export function getLoudnessVerdict(measured: MixLoudness, target: MixLoudnessTarget): LoudnessVerdict {
  const problems = findLoudnessProblems(measured, target);
  if (problems.length === 0) return { kind: "pass" };
  const band = target.warnTolerance;
  if (band !== undefined && measured.truePeak <= target.truePeak && Math.abs(measured.integrated - target.target) <= band) {
    const warning =
      `the mix measures ${formatDb(measured.integrated)} LUFS integrated, ${formatDb(measured.truePeak)} dBTP true peak: ` +
      `outside ${formatDb(target.target)} ± ${getMixTolerance(target)} LUFS, inside the ± ${band} LU near-miss band.`;
    return { kind: "warn", warning };
  }
  return { kind: "fail", problems };
}

/** What keeps a measured mix outside the target, as sentences with both values; empty when it meets it. */
export function findLoudnessProblems(measured: MixLoudness, target: MixLoudnessTarget): string[] {
  const problems: string[] = [];
  const tolerance = getMixTolerance(target);
  if (measured.truePeak > target.truePeak) problems.push(`true peak ${formatDb(measured.truePeak)} dBTP, over the ${formatDb(target.truePeak)} dBTP limit`);
  if (Math.abs(measured.integrated - target.target) > tolerance) {
    problems.push(`integrated ${formatDb(measured.integrated)} LUFS, outside ${formatDb(target.target)} ± ${tolerance} LUFS`);
  }
  return problems;
}

/** A level with one decimal and its sign (`+0.1`, `-14.0`). */
export function formatDb(value: number): string {
  const text = value.toFixed(1);
  return value > 0 && text !== "0.0" ? `+${text}` : text === "-0.0" ? "0.0" : text;
}
