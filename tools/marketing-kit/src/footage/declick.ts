import { readFileSync, rmSync, writeFileSync } from "node:fs";

import type { TimedWord } from "../voice/voiceover.js";
import { getAudioCodecArgs } from "./clip-sound.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runFfmpeg } from "./process.js";

/**
 * The speech track's declick stage (issue #1084), between the cut speech track and its loudness normalization: mouth
 * clicks and lip smacks between words are short broadband bursts well below the speech peaks, which ffmpeg's
 * `adeclick` does not see. Two steps over the cut speech, both from the words' film times:
 *
 * - a gate: outside each word's window (start and end ± 40 ms) the speech is lowered, with a 20 ms linear fade that
 *   sits outside the window, so no word onset or tail is touched;
 * - impulse removal: outside the words' own spans, bursts under 30 ms that jump above the 2-8 kHz band's running median
 *   are lowered by 30 dB with a short crossfade on both sides.
 *
 * The gain is applied per sample to the decoded PCM (a `volume` expression is evaluated only once per audio frame,
 * about 21 ms, coarser than the crossfades).
 */

export const DECLICK_LEVELS = ["off", "gentle", "strong"] as const;

export type DeclickLevel = (typeof DECLICK_LEVELS)[number];

/** A level that runs the stage. */
export type ActiveDeclickLevel = Exclude<DeclickLevel, "off">;

export interface DeclickSettings {
  /** How far the speech is lowered outside the words' windows, in dB (negative). */
  gateDb: number;
  /** How far a frame's 2-8 kHz energy must rise above the band's running median to count as an impulse, in dB. */
  jumpDb: number;
  /** The crossfade on both sides of a lowered impulse, in seconds. */
  crossfadeSeconds: number;
}

export const DECLICK_SETTINGS: Record<ActiveDeclickLevel, DeclickSettings> = {
  gentle: { gateDb: -15, jumpDb: 15, crossfadeSeconds: 0.005 },
  strong: { gateDb: -20, jumpDb: 9, crossfadeSeconds: 0.008 },
};

/** Seconds a word's window reaches past its start and end; the gate leaves the window untouched. */
export const DECLICK_WORD_WINDOW = 0.04;
/** The gate's fade, outside the window. */
export const DECLICK_GATE_FADE = 0.02;
/** The longest burst that counts as an impulse. */
export const DECLICK_MAX_IMPULSE = 0.03;
/** How far an impulse is lowered, in dB. */
export const DECLICK_IMPULSE_DB = -30;

const BAND_LOW_HZ = 2000;
const BAND_HIGH_HZ = 8000;
const FRAME_SECONDS = 0.002;
const HOP_SECONDS = 0.001;
/** The running median's reach on each side of a frame. */
const MEDIAN_SECONDS = 0.1;
/** A lowered impulse reaches this far past its detected frames, for the band filter's delay and the frames' edges. */
const IMPULSE_MARGIN = 0.001;
/** A frame quieter than this (mean square, dB) is never an impulse: digital silence with a stray bit is not a click. */
const BAND_FLOOR_DB = -90;

export interface TimeSpan {
  start: number;
  end: number;
}

/** What the stage did, in the render's and the draft's ok value. */
export interface DeclickReport {
  level: ActiveDeclickLevel;
  /** Impulses lowered. */
  impulses: number;
  /** The gate between words in dB; null when the track has no words to tell speech from pauses (no gate). */
  gateDb: number | null;
}

const fromDb = (db: number): number => 10 ** (db / 20);

const sortSpans = (words: readonly TimeSpan[]): TimeSpan[] => [...words].filter((word) => word.end > word.start).sort((a, b) => a.start - b.start);

/**
 * The windows the gate leaves open: each word's start and end ± `DECLICK_WORD_WINDOW`, merged when two windows (with
 * their fades) would touch, so the gain never dips between two close words.
 */
export function getGateWindows(words: readonly TimeSpan[]): TimeSpan[] {
  const windows: TimeSpan[] = [];
  for (const word of sortSpans(words)) {
    const start = Math.max(0, word.start - DECLICK_WORD_WINDOW);
    const end = word.end + DECLICK_WORD_WINDOW;
    const last = windows.at(-1);
    if (last !== undefined && start - last.end < 2 * DECLICK_GATE_FADE) last.end = Math.max(last.end, end);
    else windows.push({ start, end });
  }
  return windows;
}

/** One second-order section (RBJ cookbook), run in place over the samples. */
function runBiquad(samples: Float64Array, kind: "highpass" | "lowpass", frequency: number, sampleRate: number): void {
  const w0 = (2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (kind === "lowpass" ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b1 = (kind === "lowpass" ? 1 - cos : -(1 + cos)) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index++) {
    const x = samples[index] ?? 0;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    samples[index] = y;
  }
}

/** The 2-8 kHz band of the signal: two high-pass and two low-pass sections (fourth order on each side). */
function getBand(mono: Float32Array, sampleRate: number): Float64Array {
  const band = Float64Array.from(mono);
  runBiquad(band, "highpass", BAND_LOW_HZ, sampleRate);
  runBiquad(band, "highpass", BAND_LOW_HZ, sampleRate);
  runBiquad(band, "lowpass", BAND_HIGH_HZ, sampleRate);
  runBiquad(band, "lowpass", BAND_HIGH_HZ, sampleRate);
  return band;
}

/** Each frame's mean square in dB, frames of `frameLength` samples every `hop` samples. */
function getFrameEnergies(band: Float64Array, frameLength: number, hop: number): Float64Array {
  const sums = new Float64Array(band.length + 1);
  for (let index = 0; index < band.length; index++) {
    const value = band[index] ?? 0;
    sums[index + 1] = (sums[index] ?? 0) + value * value;
  }
  const count = band.length < frameLength ? 0 : Math.floor((band.length - frameLength) / hop) + 1;
  const energies = new Float64Array(count);
  for (let frame = 0; frame < count; frame++) {
    const from = frame * hop;
    const power = ((sums[from + frameLength] ?? 0) - (sums[from] ?? 0)) / frameLength;
    energies[frame] = 10 * Math.log10(Math.max(power, 1e-20));
  }
  return energies;
}

/** The index of the first entry of the sorted list not below `value`. */
function findInsertIndex(sorted: number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] ?? 0) < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The running median of the values over `reach` entries on each side (fewer at the ends). */
export function getRunningMedian(values: Float64Array, reach: number): Float64Array {
  const medians = new Float64Array(values.length);
  const window: number[] = [];
  let from = 0;
  let to = 0;
  for (let index = 0; index < values.length; index++) {
    const wantedTo = Math.min(values.length, index + reach + 1);
    for (; to < wantedTo; to++) {
      const value = values[to] ?? 0;
      window.splice(findInsertIndex(window, value), 0, value);
    }
    const wantedFrom = Math.max(0, index - reach);
    for (; from < wantedFrom; from++) window.splice(findInsertIndex(window, values[from] ?? 0), 1);
    const middle = window.length >> 1;
    medians[index] = window.length % 2 === 1 ? (window[middle] ?? 0) : ((window[middle - 1] ?? 0) + (window[middle] ?? 0)) / 2;
  }
  return medians;
}

/** True when the span overlaps a word's own span. */
const isInsideWord = (span: TimeSpan, words: readonly TimeSpan[]): boolean => words.some((word) => span.start < word.end && span.end > word.start);

/**
 * The impulses of a mono signal: runs of 2 ms frames (1 ms hop) whose 2-8 kHz energy jumps more than the level's
 * `jumpDb` above the band's running median (±100 ms), shorter than `DECLICK_MAX_IMPULSE`, overlapping no word's own
 * span. Times in seconds, widened by a millisecond on each side.
 */
export function findImpulses(mono: Float32Array, sampleRate: number, words: readonly TimeSpan[], level: ActiveDeclickLevel): TimeSpan[] {
  const { jumpDb } = DECLICK_SETTINGS[level];
  const frameLength = Math.max(1, Math.round(FRAME_SECONDS * sampleRate));
  const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const energies = getFrameEnergies(getBand(mono, sampleRate), frameLength, hop);
  const medians = getRunningMedian(energies, Math.round(MEDIAN_SECONDS / HOP_SECONDS));
  const spoken = sortSpans(words);
  const seconds = mono.length / sampleRate;
  const impulses: TimeSpan[] = [];
  let runStart = -1;
  const closeRun = (lastFrame: number): void => {
    const start = (runStart * hop) / sampleRate;
    const end = (lastFrame * hop + frameLength) / sampleRate;
    runStart = -1;
    if (end - start >= DECLICK_MAX_IMPULSE) return;
    const span = { start: Math.max(0, start - IMPULSE_MARGIN), end: Math.min(seconds, end + IMPULSE_MARGIN) };
    if (!isInsideWord(span, spoken)) impulses.push(span);
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

/** Sets the gain to `value` from sample `from` up to (not including) `to`, multiplying what is there. */
function scaleRange(gain: Float32Array, from: number, to: number, value: (index: number) => number): void {
  for (let index = Math.max(0, from); index < Math.min(gain.length, to); index++) gain[index] = (gain[index] ?? 1) * value(index);
}

/** A linear ramp from `fromValue` at sample `from` to `toValue` at sample `to`. */
const ramp = (from: number, to: number, fromValue: number, toValue: number) => (index: number) => (to <= from ? toValue : fromValue + ((toValue - fromValue) * (index - from)) / (to - from));

/**
 * The stage's gain per sample: the gate (1 inside the windows, a linear fade outside them, the gate's level beyond)
 * times a dip for every impulse (its crossfades clamped to the neighbouring words, so no word is touched). With no
 * words, no gate.
 */
export function getDeclickGain(options: { length: number; sampleRate: number; words: readonly TimeSpan[]; impulses: readonly TimeSpan[]; level: ActiveDeclickLevel }): Float32Array {
  const { length, sampleRate, level } = options;
  const settings = DECLICK_SETTINGS[level];
  const at = (seconds: number): number => Math.round(seconds * sampleRate);
  const windows = getGateWindows(options.words);
  const gate = windows.length === 0 ? 1 : fromDb(settings.gateDb);
  const gain = new Float32Array(length).fill(1);
  if (gate < 1) {
    const fade = at(DECLICK_GATE_FADE);
    const open = new Float32Array(length).fill(gate);
    for (const window of windows) {
      const start = at(window.start);
      const end = at(window.end);
      for (let index = Math.max(0, start - fade); index < Math.min(length, end + fade); index++) {
        const value = index < start ? gate + ((1 - gate) * (index - (start - fade))) / fade : index >= end ? 1 - ((1 - gate) * (index - end)) / fade : 1;
        open[index] = Math.max(open[index] ?? gate, value);
      }
    }
    gain.set(open);
  }
  const spoken = sortSpans(options.words);
  const dip = fromDb(DECLICK_IMPULSE_DB);
  const crossfade = settings.crossfadeSeconds;
  for (const impulse of options.impulses) {
    const before = spoken.filter((word) => word.end <= impulse.start).reduce((latest, word) => Math.max(latest, word.end), 0);
    const after = spoken.filter((word) => word.start >= impulse.end).reduce((earliest, word) => Math.min(earliest, word.start), Infinity);
    const start = at(impulse.start);
    const end = at(impulse.end);
    const fadeIn = at(Math.max(before, impulse.start - crossfade));
    const fadeOut = at(Math.min(after, impulse.end + crossfade));
    scaleRange(gain, fadeIn, start, ramp(fadeIn, start, 1, dip));
    scaleRange(gain, start, end, () => dip);
    scaleRange(gain, end, fadeOut, ramp(end, fadeOut, dip, 1));
  }
  return gain;
}

/** The stage over interleaved samples: the impulses found on the channels' average, then the gain on every channel. */
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
  const impulses = findImpulses(mono, sampleRate, words, level);
  const gain = getDeclickGain({ length, sampleRate, words, impulses, level });
  const output = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index++) output[index] = (samples[index] ?? 0) * (gain[Math.floor(index / channels)] ?? 1);
  const hasGate = getGateWindows(words).length > 0;
  return { samples: output, impulses, report: { level, impulses: impulses.length, gateDb: hasGate ? DECLICK_SETTINGS[level].gateDb : null } };
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

/** Runs the stage on a speech track file: decode, find and lower, encode. The raw PCM next to the output is removed. */
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

/** The stage's log line. */
export function describeDeclick(report: DeclickReport): string {
  const gate = report.gateDb === null ? "no words, so no gate" : `the pauses lowered by ${String(-report.gateDb)} dB`;
  return `declick (${report.level}): ${String(report.impulses)} impulse${report.impulses === 1 ? "" : "s"} removed, ${gate}.`;
}
