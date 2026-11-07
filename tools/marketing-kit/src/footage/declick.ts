import { readFileSync, rmSync, writeFileSync } from "node:fs";

import type { TimedWord } from "../voice/voiceover.js";
import { getAudioCodecArgs } from "./clip-sound.js";
import { MOUTH_CLICK_RULES, analyzeMouthClicks } from "./mouth-clicks.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runFfmpeg } from "./process.js";
import { getBand, getFrameEnergies, getRunningMedian, type TimeSpan } from "./sound-analysis.js";

export { getRunningMedian, type TimeSpan };

/**
 * The speech track's declick stage (issues #1084, #1170), between the cut speech track and its loudness normalization:
 * mouth clicks and lip smacks in the pauses are short broadband bursts well below the speech peaks, which ffmpeg's
 * `adeclick` does not see. The stage repairs single impulses and changes no gain:
 *
 * - it touches nothing within ±80 ms of a transcript word (`DECLICK_WORD_GUARD`): the speech-to-text boundaries are 20
 *   to 60 ms off the real sound, so a gate on them lowered decays and onsets and was heard as hoarseness and pumping
 *   (#1170). Only the pauses beyond that guard are searched, so a pause must be longer than 160 ms to hold a repair;
 * - an impulse is a burst under `DECLICK_MAX_IMPULSE` whose 2-8 kHz energy jumps above the band's running median; its
 *   samples are replaced by AR (LPC) interpolation from the sound on both sides, joined with a raised-cosine crossfade
 *   of `DECLICK_CROSSFADE` on each side. Every other sample leaves the stage as it came in.
 *
 * The `repair` level (issue #1183) uses the mouth-click detector shared with moving a cut (`MOUTH_CLICK_RULES`,
 * issue #1182) instead: impulses of 1 to 25 ms, outside the speech protection zone (word bounds on the real sound
 * ±80 ms, nothing above -45 dBFS), only in pauses at least 150 ms long after the guard, and within the limits of
 * `DECLICK_REPAIR_RULES` (the impulses over a limit are left and counted).
 *
 * Without words the stage repairs nothing: it cannot tell a click from a consonant.
 */

export const DECLICK_LEVELS = ["off", "gentle", "strong", "repair"] as const;

export type DeclickLevel = (typeof DECLICK_LEVELS)[number];

/** A level that runs the stage. */
export type ActiveDeclickLevel = Exclude<DeclickLevel, "off">;

/** A level that runs the 0.18.0 detector (`findImpulses`, `DECLICK_SETTINGS`). */
export type DetectorDeclickLevel = Exclude<ActiveDeclickLevel, "repair">;

export interface DeclickSettings {
  /** How far a frame's 2-8 kHz energy must rise above the band's running median to count as an impulse, in dB. */
  jumpDb: number;
}

export const DECLICK_SETTINGS: Record<DetectorDeclickLevel, DeclickSettings> = {
  gentle: { jumpDb: 15 },
  strong: { jumpDb: 9 },
};

/** Seconds around each word's start and end that the stage never touches. */
export const DECLICK_WORD_GUARD = 0.08;
/** The longest burst that counts as an impulse. */
export const DECLICK_MAX_IMPULSE = 0.012;
/** The raised-cosine crossfade between the original and the interpolation on each side of a repair. */
export const DECLICK_CROSSFADE = 0.003;
/** The `repair` level's rules (issue #1183); its impulses are `MOUTH_CLICK_RULES`'. */
export const DECLICK_REPAIR_RULES = {
  /** The shortest pause that holds a repair once the word guard is taken off both sides, seconds. */
  minPauseSeconds: 0.15,
  /** The longest repair, its crossfades included, seconds. */
  maxRepairSeconds: 0.025,
  /** The most repairs in any one second. */
  maxPerSecond: 3,
  /** The share of the track's length all repairs (crossfades included) may take. */
  maxShare: 0.01,
} as const;
/** The AR model's order. */
export const DECLICK_AR_ORDER = 24;
/** Seconds of sound on each side of a repair the AR model is fitted on. */
export const DECLICK_AR_CONTEXT = 0.01;

const BAND_LOW_HZ = 2000;
const BAND_HIGH_HZ = 8000;
const FRAME_SECONDS = 0.002;
const HOP_SECONDS = 0.001;
/** The running median's reach on each side of a frame. */
const MEDIAN_SECONDS = 0.1;
/** A repaired impulse reaches this far past its detected frames, for the band filter's delay and the frames' edges. */
const IMPULSE_MARGIN = 0.001;
/** A frame quieter than this (mean square, dB) is never an impulse: digital silence with a stray bit is not a click. */
const BAND_FLOOR_DB = -90;
/** Added to Burg's denominator, so a silent context gives a zero model instead of a division by zero. */
const AR_RIDGE = 1e-9;

/** What the stage did, in the render's and the draft's ok value. */
export interface DeclickReport {
  level: ActiveDeclickLevel;
  /** Impulses repaired. */
  impulses: number;
  /** Each repaired impulse in the speech track's time, seconds (without its crossfades). */
  repairs: TimeSpan[];
  /** Impulses the `repair` level left because a limit of `DECLICK_REPAIR_RULES` was reached; 0 for the other levels. */
  skippedLimit: number;
}

const sortSpans = (words: readonly TimeSpan[]): TimeSpan[] => [...words].filter((word) => word.end > word.start).sort((a, b) => a.start - b.start);

/**
 * The stretches the stage may change: the pauses before the first word, between words and after the last, each shrunk
 * by `DECLICK_WORD_GUARD` on every side that meets a word. None without words.
 */
export function getRepairZones(words: readonly TimeSpan[], seconds: number): TimeSpan[] {
  const spoken = sortSpans(words);
  if (spoken.length === 0) return [];
  const zones: TimeSpan[] = [];
  let from = 0;
  let isAfterWord = false;
  for (const word of spoken) {
    const start = isAfterWord ? from + DECLICK_WORD_GUARD : from;
    const end = word.start - DECLICK_WORD_GUARD;
    if (end > start) zones.push({ start, end });
    from = Math.max(from, word.end);
    isAfterWord = true;
  }
  const start = from + DECLICK_WORD_GUARD;
  if (seconds > start) zones.push({ start, end: seconds });
  return zones;
}

/** True when the impulse with its crossfades lies inside one zone. */
const isRepairable = (span: TimeSpan, zones: readonly TimeSpan[]): boolean =>
  zones.some((zone) => span.start - DECLICK_CROSSFADE >= zone.start && span.end + DECLICK_CROSSFADE <= zone.end);

/**
 * The impulses of a mono signal the stage repairs: runs of 2 ms frames (1 ms hop) whose 2-8 kHz energy jumps more than
 * the level's `jumpDb` above the band's running median (±100 ms), shorter than `DECLICK_MAX_IMPULSE`, that lie with
 * their crossfades inside a repair zone (`getRepairZones`). Times in seconds, widened by a millisecond on each side.
 */
export function findImpulses(mono: Float32Array, sampleRate: number, words: readonly TimeSpan[], level: DetectorDeclickLevel): TimeSpan[] {
  const seconds = mono.length / sampleRate;
  const zones = getRepairZones(words, seconds);
  if (zones.length === 0) return [];
  const { jumpDb } = DECLICK_SETTINGS[level];
  const frameLength = Math.max(1, Math.round(FRAME_SECONDS * sampleRate));
  const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const energies = getFrameEnergies(getBand({ mono, sampleRate, lowHz: BAND_LOW_HZ, highHz: BAND_HIGH_HZ }), frameLength, hop);
  const medians = getRunningMedian(energies, Math.round(MEDIAN_SECONDS / HOP_SECONDS));
  const impulses: TimeSpan[] = [];
  let runStart = -1;
  const closeRun = (lastFrame: number): void => {
    const start = (runStart * hop) / sampleRate;
    const end = (lastFrame * hop + frameLength) / sampleRate;
    runStart = -1;
    if (end - start >= DECLICK_MAX_IMPULSE) return;
    const span = { start: Math.max(0, start - IMPULSE_MARGIN), end: Math.min(seconds, end + IMPULSE_MARGIN) };
    if (isRepairable(span, zones)) impulses.push(span);
  };
  for (let frame = 0; frame < energies.length; frame++) {
    const energy = energies[frame] ?? 0;
    const isJump = energy > BAND_FLOOR_DB && energy - (medians[frame] ?? 0) > jumpDb;
    if (isJump && runStart === -1) runStart = frame;
    else if (!isJump && runStart !== -1) closeRun(frame - 1);
  }
  if (runStart !== -1) closeRun(energies.length - 1);
  return impulses;
}

/**
 * The impulses the `repair` level repairs (issue #1183): `MOUTH_CLICK_RULES` impulses whose repair (with its
 * crossfades) lies inside a pause at least `minPauseSeconds` long between the words' bounds on the real sound after
 * the guard, outside the speech protection zone, taken in time order while the limits allow; the others in such a
 * pause are counted as `skippedLimit`.
 */
export function findRepairs(mono: Float32Array, sampleRate: number, words: readonly TimeSpan[]): { repairs: TimeSpan[]; skippedLimit: number } {
  const seconds = mono.length / sampleRate;
  const analysis = analyzeMouthClicks(mono, sampleRate, words);
  const zones = getRepairZones(analysis.bounds, seconds).filter((zone) => zone.end - zone.start >= DECLICK_REPAIR_RULES.minPauseSeconds);
  const budget = DECLICK_REPAIR_RULES.maxShare * seconds;
  const repairs: TimeSpan[] = [];
  let used = 0;
  let skippedLimit = 0;
  for (const candidate of analysis.candidates) {
    const span = { start: candidate.start - DECLICK_CROSSFADE, end: candidate.end + DECLICK_CROSSFADE };
    if (!zones.some((zone) => span.start >= zone.start && span.end <= zone.end) || analysis.isProtected(span)) continue;
    const length = span.end - span.start;
    const inLastSecond = repairs.filter((repair) => repair.start > candidate.start - 1).length;
    if (length > DECLICK_REPAIR_RULES.maxRepairSeconds || inLastSecond >= DECLICK_REPAIR_RULES.maxPerSecond || used + length > budget) {
      skippedLimit++;
      continue;
    }
    repairs.push(candidate);
    used += length;
  }
  return { repairs, skippedLimit };
}

/**
 * The AR polynomial of the context segments (Burg's method over all of them at once): `a[0] = 1` and
 * `Σ a[k]·x[n-k] ≈ 0`. Fewer coefficients when the segments are short; a silent context gives all zeros after `a[0]`.
 */
export function getArPolynomial(segments: readonly Float64Array[], order: number): Float64Array {
  const longest = Math.max(0, ...segments.map((segment) => segment.length));
  const usable = Math.min(order, Math.floor(longest / 2));
  const forward = segments.map((segment) => Float64Array.from(segment));
  const backward = segments.map((segment) => Float64Array.from(segment));
  let polynomial = new Float64Array(usable + 1);
  polynomial[0] = 1;
  for (let step = 1; step <= usable; step++) {
    let numerator = 0;
    let denominator = AR_RIDGE;
    forward.forEach((f, segment) => {
      const b = backward[segment] ?? f;
      for (let index = step; index < f.length; index++) {
        numerator += (f[index] ?? 0) * (b[index - 1] ?? 0);
        denominator += (f[index] ?? 0) ** 2 + (b[index - 1] ?? 0) ** 2;
      }
    });
    const reflection = (-2 * numerator) / denominator;
    forward.forEach((f, segment) => {
      const b = backward[segment] ?? f;
      for (let index = f.length - 1; index >= step; index--) {
        const fValue = f[index] ?? 0;
        const bValue = b[index - 1] ?? 0;
        f[index] = fValue + reflection * bValue;
        b[index] = bValue + reflection * fValue;
      }
    });
    const next = Float64Array.from(polynomial);
    for (let k = 1; k <= step; k++) next[k] = (polynomial[k] ?? 0) + reflection * (polynomial[step - k] ?? 0);
    polynomial = next;
  }
  return polynomial;
}

/**
 * Solves `B·x = rhs` for a symmetric positive definite banded Toeplitz `B` (`B[i][j] = band[|i-j|]`, zero beyond the
 * band) by a banded Cholesky factorization.
 */
function solveBandedToeplitz(band: Float64Array, rhs: Float64Array): Float64Array {
  const size = rhs.length;
  const width = band.length - 1;
  // lower[i * (width + 1) + d] holds L(i, i - d).
  const lower = new Float64Array(size * (width + 1));
  const at = (row: number, column: number): number => lower[row * (width + 1) + (row - column)] ?? 0;
  for (let row = 0; row < size; row++) {
    for (let column = Math.max(0, row - width); column <= row; column++) {
      let sum = band[row - column] ?? 0;
      for (let k = Math.max(0, row - width); k < column; k++) sum -= at(row, k) * at(column, k);
      lower[row * (width + 1) + (row - column)] = row === column ? Math.sqrt(Math.max(sum, 1e-30)) : sum / at(column, column);
    }
  }
  const middle = new Float64Array(size);
  for (let row = 0; row < size; row++) {
    let sum = rhs[row] ?? 0;
    for (let k = Math.max(0, row - width); k < row; k++) sum -= at(row, k) * (middle[k] ?? 0);
    middle[row] = sum / at(row, row);
  }
  const solution = new Float64Array(size);
  for (let row = size - 1; row >= 0; row--) {
    let sum = middle[row] ?? 0;
    for (let k = row + 1; k <= Math.min(size - 1, row + width); k++) sum -= at(k, row) * (solution[k] ?? 0);
    solution[row] = sum / at(row, row);
  }
  return solution;
}

/**
 * Repairs samples `from` to `to` (exclusive) of one channel in place by least-squares AR interpolation: an AR model
 * fitted on `context` samples on both sides, and the samples that minimize the model's residual energy given the
 * sound around them (samples beyond the track count as zero). A raised-cosine crossfade of `crossfade` samples at each
 * end joins the interpolation to the original.
 */
export function repairSpan(options: { channel: Float64Array; from: number; to: number; crossfade: number; context: number }): void {
  const { channel, crossfade, context } = options;
  const from = Math.max(0, options.from);
  const to = Math.min(channel.length, options.to);
  const count = to - from;
  if (count <= 0) return;
  const polynomial = getArPolynomial([channel.slice(Math.max(0, from - context), from), channel.slice(to, Math.min(channel.length, to + context))], DECLICK_AR_ORDER);
  const order = polynomial.length - 1;
  const band = new Float64Array(order + 1);
  for (let lag = 0; lag <= order; lag++) for (let k = 0; k + lag <= order; k++) band[lag] = (band[lag] ?? 0) + (polynomial[k] ?? 0) * (polynomial[k + lag] ?? 0);
  const known = (index: number): number => (index < 0 || index >= channel.length || (index >= from && index < to) ? 0 : (channel[index] ?? 0));
  const rhs = new Float64Array(count);
  for (let row = from; row < to + order; row++) {
    let residual = 0;
    for (let k = 0; k <= order; k++) residual += (polynomial[k] ?? 0) * known(row - k);
    for (let index = Math.max(from, row - order); index <= Math.min(to - 1, row); index++) rhs[index - from] = (rhs[index - from] ?? 0) - (polynomial[row - index] ?? 0) * residual;
  }
  const interpolated = solveBandedToeplitz(band, rhs);
  for (let offset = 0; offset < count; offset++) {
    const edge = Math.min(offset + 0.5, count - offset - 0.5);
    const mix = crossfade <= 0 || edge >= crossfade ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * edge) / crossfade);
    channel[from + offset] = mix * (interpolated[offset] ?? 0) + (1 - mix) * (channel[from + offset] ?? 0);
  }
}

/**
 * The stage over interleaved samples: the impulses found on the channels' average, then each one repaired on every
 * channel (with its crossfades). Every sample outside the repairs is returned as it came in.
 */
export function declickSamples(options: { samples: Float32Array; channels: number; sampleRate: number; words: readonly TimeSpan[]; level: ActiveDeclickLevel }): {
  samples: Float32Array;
  impulses: TimeSpan[];
  report: DeclickReport;
} {
  const { samples, channels, sampleRate, words, level } = options;
  const length = Math.floor(samples.length / channels);
  const mono = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) sum += samples[index * channels + channel] ?? 0;
    mono[index] = sum / channels;
  }
  const found = level === "repair" ? findRepairs(mono, sampleRate, words) : { repairs: findImpulses(mono, sampleRate, words, level), skippedLimit: 0 };
  const impulses = found.repairs;
  const output = Float32Array.from(samples);
  const crossfade = Math.round(DECLICK_CROSSFADE * sampleRate);
  const context = Math.round(DECLICK_AR_CONTEXT * sampleRate);
  for (let channel = 0; channel < channels && impulses.length > 0; channel++) {
    const track = new Float64Array(length);
    for (let index = 0; index < length; index++) track[index] = samples[index * channels + channel] ?? 0;
    for (const impulse of impulses) {
      const from = Math.round(impulse.start * sampleRate) - crossfade;
      const to = Math.round(impulse.end * sampleRate) + crossfade;
      repairSpan({ channel: track, from, to, crossfade, context });
      for (let index = Math.max(0, from); index < Math.min(length, to); index++) output[index * channels + channel] = track[index] ?? 0;
    }
  }
  return { samples: output, impulses, report: { level, impulses: impulses.length, repairs: impulses.map((impulse) => ({ ...impulse })), skippedLimit: found.skippedLimit } };
}

const CHANNELS = 2;
const PCM_FORMAT = ["-f", "f32le", "-ar", String(FOOTAGE_SAMPLE_RATE), "-ac", String(CHANNELS)];

/** The cut speech decoded to raw 32-bit float PCM at the film's rate, stereo. */
export function buildDeclickDecodeArgs(input: string, output: string): string[] {
  return ["-v", "error", "-y", "-i", input, "-vn", "-c:a", "pcm_f32le", ...PCM_FORMAT, output];
}

/** The declicked PCM encoded by the output's extension (`getAudioCodecArgs`: `.wav` lossless float, as the chain writes it). */
export function buildDeclickEncodeArgs(input: string, output: string): string[] {
  return ["-v", "error", "-y", ...PCM_FORMAT, "-i", input, ...getAudioCodecArgs(output), output];
}

/** Raw little-endian float32 bytes as samples (copied, so the view is aligned). */
function readFloats(file: string): Float32Array {
  const bytes = readFileSync(file);
  const samples = new Float32Array(Math.floor(bytes.length / 4));
  for (let index = 0; index < samples.length; index++) samples[index] = bytes.readFloatLE(index * 4);
  return samples;
}

function writeFloats(file: string, samples: Float32Array): void {
  const bytes = Buffer.alloc(samples.length * 4);
  for (let index = 0; index < samples.length; index++) bytes.writeFloatLE(samples[index] ?? 0, index * 4);
  writeFileSync(file, bytes);
}

export interface DeclickSpeechOptions {
  /** The cut speech track. */
  input: string;
  /** The declicked track: `.wav` (float) or `.mp3`. */
  output: string;
  /** The words in film time (the speech track's time). */
  words: readonly TimedWord[];
  level: ActiveDeclickLevel;
  /** The track's seconds, for the progress: decoding is its first half, encoding its second. */
  seconds: number;
  signal?: AbortSignal;
  onSeconds?: (done: number) => void;
}

/** Runs the stage on a speech track file: decode, find and repair, encode. The raw PCM next to the output is removed. */
export async function declickSpeech(options: DeclickSpeechOptions): Promise<DeclickReport> {
  const { input, output, seconds } = options;
  const aborting = options.signal === undefined ? {} : { signal: options.signal };
  const raw = `${output}.f32`;
  const report = (done: number): void => options.onSeconds?.(Math.min(seconds, Math.max(0, done)));
  try {
    await runFfmpeg("The speech declick's decode", buildDeclickDecodeArgs(input, raw), { ...aborting, output: raw, onSeconds: (done) => report(done / 2) });
    const declicked = declickSamples({ samples: readFloats(raw), channels: CHANNELS, sampleRate: FOOTAGE_SAMPLE_RATE, words: options.words, level: options.level });
    writeFloats(raw, declicked.samples);
    await runFfmpeg("The speech declick's encode", buildDeclickEncodeArgs(raw, output), { ...aborting, output, onSeconds: (done) => report(seconds / 2 + done / 2) });
    return declicked.report;
  } finally {
    rmSync(raw, { force: true });
  }
}

/** How many repair times the log line lists. */
const LOGGED_REPAIRS = 8;

/** The stage's log line. */
export function describeDeclick(report: DeclickReport): string {
  const times = report.repairs.slice(0, LOGGED_REPAIRS).map((repair) => `${repair.start.toFixed(3)} s`);
  const more = report.repairs.length > LOGGED_REPAIRS ? `, +${String(report.repairs.length - LOGGED_REPAIRS)} more` : "";
  const where = times.length === 0 ? "" : ` at ${times.join(", ")}${more}`;
  const count = `${String(report.impulses)} impulse${report.impulses === 1 ? "" : "s"} repaired${where}`;
  if (report.level !== "repair") return `declick (${report.level}): ${count}; no gain change, nothing within ${String(DECLICK_WORD_GUARD * 1000)} ms of a word touched.`;
  return `declick (repair): ${count}, ${String(report.skippedLimit)} left over the limits; no gain change, nothing within ${String(DECLICK_WORD_GUARD * 1000)} ms of a word's sound or above ${String(MOUTH_CLICK_RULES.loudDbfs)} dBFS touched.`;
}
