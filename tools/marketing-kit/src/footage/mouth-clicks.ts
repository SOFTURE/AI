import { getBand, getFrameEnergies, getRunningMedian, getSquareSums, toPowerDb, type TimeSpan } from "./sound-analysis.js";

/**
 * The mouth-click detector shared by moving a segment's cut past a click (stage A, issue #1182) and the declick
 * stage's `repair` level (stage B, issue #1183), so a click that moves a cut and a click that is repaired are the same
 * thing. Its input is the speech as the chain hears it: the clips' sound after the -23 LUFS pre-gain.
 *
 * - **An impulse** lasts 1 to 25 ms, its 2-10 kHz energy rises more than 12 dB above the band's ±50 ms running median,
 *   it is not periodic (the band's normalized autocorrelation stays under 0.3 at the pitch lags, 2.5 to 15 ms, over a
 *   30 ms window centred on it) and it is over within its length (the 10 ms after it at least 12 dB under its peak, so
 *   the onset of a breath or a fricative is not one).
 * - **The speech protection zone:** each word's bound on the real sound (the earlier start and the later end of the
 *   transcript's bound and the point where the 10 ms energy falls 20 dB under the word's peak), widened by 80 ms; and
 *   every stretch whose 10 ms energy is above -45 dBFS, measured with the impulses' own samples left out (a click's
 *   own energy must not protect it).
 */
export const MOUTH_CLICK_RULES = {
  /** The shortest impulse, seconds. */
  minSeconds: 0.001,
  /** The longest impulse, seconds. */
  maxSeconds: 0.025,
  /** The band the impulse is measured in. */
  bandLowHz: 2000,
  bandHighHz: 10_000,
  /** How far an impulse's band energy rises above the band's running median, dB. */
  jumpDb: 12,
  /** The running median's reach on each side, seconds. */
  medianSeconds: 0.05,
  /** The highest normalized autocorrelation at the pitch lags an impulse may show. */
  maxCorrelation: 0.3,
  /** The pitch lags, seconds. */
  minLagSeconds: 0.0025,
  maxLagSeconds: 0.015,
  /** The window the autocorrelation is measured over, centred on the impulse, seconds. */
  correlationSeconds: 0.03,
  /** The stretch after an impulse that must be quieter than its peak, seconds, and by how much, dB. */
  afterSeconds: 0.01,
  afterDropDb: 12,
  /** The energy window of the word bounds and the loudness rule, seconds. */
  energySeconds: 0.01,
  /** A word's sound lasts while its 10 ms energy stays within this many dB of the word's peak. */
  wordDropDb: 20,
  /** The guard on each side of a word's bound, seconds. */
  wordGuardSeconds: 0.08,
  /** Nothing whose 10 ms energy is above this is a click to act on, dBFS (mean square). */
  loudDbfs: -45,
} as const;

const FRAME_SECONDS = 0.002;
const HOP_SECONDS = 0.001;
/** The step the word bounds and the loudness rule are measured at. */
const STEP_SECONDS = 0.001;
/** An impulse reaches this far past its detected frames, for the band filter's delay and the frames' edges. */
const IMPULSE_MARGIN = 0.001;
/** A frame quieter than this (mean square, dB) is never an impulse: digital silence with a stray bit is not a click. */
const BAND_FLOOR_DB = -90;

/** The highest normalized autocorrelation of `band` at the pitch lags over the window centred on `center`. */
function getPeakCorrelation(band: Float64Array, center: number, sampleRate: number): number {
  const half = Math.round((MOUTH_CLICK_RULES.correlationSeconds * sampleRate) / 2);
  const from = Math.max(0, center - half);
  const to = Math.min(band.length, center + half);
  const minLag = Math.max(1, Math.round(MOUTH_CLICK_RULES.minLagSeconds * sampleRate));
  const maxLag = Math.min(Math.round(MOUTH_CLICK_RULES.maxLagSeconds * sampleRate), to - from - 1);
  let peak = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let product = 0;
    let head = 0;
    let tail = 0;
    for (let index = from; index + lag < to; index++) {
      const a = band[index] ?? 0;
      const b = band[index + lag] ?? 0;
      product += a * b;
      head += a * a;
      tail += b * b;
    }
    if (head > 0 && tail > 0) peak = Math.max(peak, product / Math.sqrt(head * tail));
  }
  return peak;
}

/**
 * The impulses of a mono signal by `MOUTH_CLICK_RULES` (length, band jump, periodicity, end), anywhere in it. Times in
 * seconds from sample 0, widened by a millisecond on each side.
 */
export function findClickCandidates(mono: Float32Array, sampleRate: number): TimeSpan[] {
  const seconds = mono.length / sampleRate;
  const band = getBand({ mono, sampleRate, lowHz: MOUTH_CLICK_RULES.bandLowHz, highHz: MOUTH_CLICK_RULES.bandHighHz });
  const sums = getSquareSums(band);
  const frameLength = Math.max(1, Math.round(FRAME_SECONDS * sampleRate));
  const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const after = Math.round(MOUTH_CLICK_RULES.afterSeconds * sampleRate);
  const energies = getFrameEnergies(band, frameLength, hop);
  const medians = getRunningMedian(energies, Math.round(MOUTH_CLICK_RULES.medianSeconds / HOP_SECONDS));
  const candidates: TimeSpan[] = [];
  const checkRun = (first: number, last: number): void => {
    const start = (first * hop) / sampleRate;
    const end = (last * hop + frameLength) / sampleRate;
    if (end - start < MOUTH_CLICK_RULES.minSeconds || end - start > MOUTH_CLICK_RULES.maxSeconds) return;
    const span = { start: Math.max(0, start - IMPULSE_MARGIN), end: Math.min(seconds, end + IMPULSE_MARGIN) };
    let peakDb = -Infinity;
    for (let frame = first; frame <= last; frame++) peakDb = Math.max(peakDb, energies[frame] ?? -Infinity);
    const afterFrom = Math.round(span.end * sampleRate);
    const afterTo = Math.min(band.length, afterFrom + after);
    if (afterTo > afterFrom && toPowerDb(((sums[afterTo] ?? 0) - (sums[afterFrom] ?? 0)) / (afterTo - afterFrom)) > peakDb - MOUTH_CLICK_RULES.afterDropDb) return;
    const center = Math.round(((span.start + span.end) / 2) * sampleRate);
    if (getPeakCorrelation(band, center, sampleRate) >= MOUTH_CLICK_RULES.maxCorrelation) return;
    candidates.push(span);
  };
  let runStart = -1;
  for (let frame = 0; frame < energies.length; frame++) {
    const energy = energies[frame] ?? 0;
    const isJump = energy > BAND_FLOOR_DB && energy - (medians[frame] ?? 0) > MOUTH_CLICK_RULES.jumpDb;
    if (isJump && runStart === -1) runStart = frame;
    else if (!isJump && runStart !== -1) {
      checkRun(runStart, frame - 1);
      runStart = -1;
    }
  }
  if (runStart !== -1) checkRun(runStart, energies.length - 1);
  return candidates;
}

/** The analysis of one mono stretch in its own time (sample 0 at 0 s). */
export interface MouthClickAnalysis {
  /** Every impulse by the rule, protected or not. */
  candidates: TimeSpan[];
  /** Each word's bound on the real sound (before the guard). */
  bounds: TimeSpan[];
  /** True when the span touches a word's bound with its guard, or a 10 ms energy above the loudness rule. */
  isProtected: (span: TimeSpan) => boolean;
  /** True when the stretch holds no 10 ms window above the loudness rule, the impulses' samples left out. */
  isQuiet: (stretch: TimeSpan) => boolean;
}

/** The detector over a mono stretch whose words are in the stretch's own time. */
export function analyzeMouthClicks(mono: Float32Array, sampleRate: number, words: readonly TimeSpan[]): MouthClickAnalysis {
  const length = mono.length;
  const candidates = findClickCandidates(mono, sampleRate);
  const sums = getSquareSums(mono);
  const masked = Float64Array.from(mono);
  const counts = new Float64Array(length + 1);
  const isMasked = new Uint8Array(length);
  for (const candidate of candidates) {
    for (let index = Math.max(0, Math.floor(candidate.start * sampleRate)); index < Math.min(length, Math.ceil(candidate.end * sampleRate)); index++) {
      isMasked[index] = 1;
      masked[index] = 0;
    }
  }
  for (let index = 0; index < length; index++) counts[index + 1] = (counts[index] ?? 0) + (isMasked[index] === 1 ? 0 : 1);
  const maskedSums = getSquareSums(masked);
  const window = Math.max(1, Math.round(MOUTH_CLICK_RULES.energySeconds * sampleRate));
  const step = Math.max(1, Math.round(STEP_SECONDS * sampleRate));
  const clamp = (index: number): number => Math.min(length, Math.max(0, index));
  const getDb = (from: number, to: number): number => {
    const [a, b] = [clamp(from), clamp(to)];
    return b > a ? toPowerDb(((sums[b] ?? 0) - (sums[a] ?? 0)) / (b - a)) : -Infinity;
  };
  const getMaskedDb = (from: number, to: number): number => {
    const [a, b] = [clamp(from), clamp(to)];
    const count = (counts[b] ?? 0) - (counts[a] ?? 0);
    return count > 0 ? toPowerDb(((maskedSums[b] ?? 0) - (maskedSums[a] ?? 0)) / count) : -Infinity;
  };
  const getBound = (word: TimeSpan): TimeSpan => {
    const from = clamp(Math.round(word.start * sampleRate));
    const to = clamp(Math.round(word.end * sampleRate));
    if (to <= from) return { ...word };
    let peakDb = -Infinity;
    for (let index = from; index <= Math.max(from, to - window); index += step) peakDb = Math.max(peakDb, getDb(index, Math.min(to, index + window)));
    const threshold = peakDb - MOUTH_CLICK_RULES.wordDropDb;
    // The start walks back while the 10 ms before it hold the word's sound, the end forward while the 10 ms after it do.
    let start = from;
    while (start > 0 && getDb(start - window, start) >= threshold) start = clamp(start - step);
    let end = to;
    while (end < length && getDb(end, end + window) >= threshold) end = clamp(end + step);
    return { start: Math.min(word.start, start / sampleRate), end: Math.max(word.end, end / sampleRate) };
  };
  const bounds = [...words].filter((word) => word.end > word.start).sort((a, b) => a.start - b.start).map(getBound);
  const isLoud = (span: TimeSpan): boolean => {
    const from = Math.floor(span.start * sampleRate);
    const to = Math.ceil(span.end * sampleRate);
    for (let center = from; ; center = Math.min(to, center + step)) {
      if (getMaskedDb(center - (window >> 1), center + window - (window >> 1)) > MOUTH_CLICK_RULES.loudDbfs) return true;
      if (center >= to) return false;
    }
  };
  const guard = MOUTH_CLICK_RULES.wordGuardSeconds;
  return {
    candidates,
    bounds,
    isProtected: (span) => bounds.some((bound) => span.start < bound.end + guard && span.end > bound.start - guard) || isLoud(span),
    isQuiet: (stretch) => stretch.end <= 0 || stretch.start >= length / sampleRate || !isLoud({ start: Math.max(0, stretch.start), end: Math.min(length / sampleRate, stretch.end) }),
  };
}

/** What `findMouthClicks` found, in the film's time (the stretch's `offset` added). */
export interface MouthClicks {
  /** The impulses outside the speech protection zone, in time order. */
  clicks: TimeSpan[];
  /** Each word's bound on the real sound (before the ±80 ms guard), in time order. */
  words: TimeSpan[];
  /** True when the stretch holds no 10 ms window above -45 dBFS, the impulses' samples left out. */
  isQuiet: (stretch: TimeSpan) => boolean;
}

/**
 * Mouth clicks of a mono stretch whose sample 0 plays at `offset` seconds, outside the speech protection zone
 * (`MOUTH_CLICK_RULES`); `words` are in the same time as `offset`. No audio is changed: an app can move a segment's
 * cut past a click before its first word or after its last (issue #1182).
 */
export function findMouthClicks(options: { mono: Float32Array; sampleRate: number; offset: number; words: readonly TimeSpan[] }): MouthClicks {
  const { mono, sampleRate, offset } = options;
  const shift = (span: TimeSpan, by: number): TimeSpan => ({ start: span.start + by, end: span.end + by });
  const analysis = analyzeMouthClicks(
    mono,
    sampleRate,
    options.words.map((word) => shift(word, -offset)),
  );
  return {
    clicks: analysis.candidates.filter((candidate) => !analysis.isProtected(candidate)).map((candidate) => shift(candidate, offset)),
    words: analysis.bounds.map((bound) => shift(bound, offset)),
    isQuiet: (stretch) => analysis.isQuiet(shift(stretch, -offset)),
  };
}
