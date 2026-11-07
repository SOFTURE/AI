/**
 * Sound analysis shared by the speech declick stage and the mouth-click detector (issues #1170, #1182, #1183): a
 * fourth-order band pass, frame energies and a running median.
 */

/** A stretch of time in seconds. */
export interface TimeSpan {
  start: number;
  end: number;
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

/** The band of the signal between `lowHz` and `highHz`: two high-pass and two low-pass sections (fourth order on each side). */
export function getBand(options: { mono: Float32Array; sampleRate: number; lowHz: number; highHz: number }): Float64Array {
  const { mono, sampleRate, lowHz, highHz } = options;
  const band = Float64Array.from(mono);
  runBiquad(band, "highpass", lowHz, sampleRate);
  runBiquad(band, "highpass", lowHz, sampleRate);
  runBiquad(band, "lowpass", highHz, sampleRate);
  runBiquad(band, "lowpass", highHz, sampleRate);
  return band;
}

/** The running sums of the squared samples: `sums[i]` is the energy of samples 0 to i - 1. */
export function getSquareSums(samples: ArrayLike<number>): Float64Array {
  const sums = new Float64Array(samples.length + 1);
  for (let index = 0; index < samples.length; index++) {
    const value = samples[index] ?? 0;
    sums[index + 1] = (sums[index] ?? 0) + value * value;
  }
  return sums;
}

/** A mean square in dB (10·log10), with a floor so silence stays finite. */
export const toPowerDb = (meanSquare: number): number => 10 * Math.log10(Math.max(meanSquare, 1e-20));

/** Each frame's mean square in dB, frames of `frameLength` samples every `hop` samples. */
export function getFrameEnergies(band: Float64Array, frameLength: number, hop: number): Float64Array {
  const sums = getSquareSums(band);
  const count = band.length < frameLength ? 0 : Math.floor((band.length - frameLength) / hop) + 1;
  const energies = new Float64Array(count);
  for (let frame = 0; frame < count; frame++) {
    const from = frame * hop;
    energies[frame] = toPowerDb(((sums[from + frameLength] ?? 0) - (sums[from] ?? 0)) / frameLength);
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
