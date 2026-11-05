import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DECLICK_GATE_FADE,
  DECLICK_SETTINGS,
  DECLICK_WORD_WINDOW,
  buildDeclickDecodeArgs,
  buildDeclickEncodeArgs,
  declickSamples,
  declickSpeech,
  describeDeclick,
  findImpulses,
  getGateWindows,
  getRunningMedian,
  type ActiveDeclickLevel,
  type TimeSpan,
} from "./declick.js";

const RATE = 48_000;

/** A seeded generator, so every run builds the same fixture. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-12));

interface Fixture {
  samples: Float32Array;
  words: TimeSpan[];
  clicks: TimeSpan[];
  clickPeaks: number[];
}

/**
 * Ten tonal "words" (300 ms, harmonics of 140-260 Hz under a 10 ms onset and a 20 ms release) 500 ms apart, room tone
 * at about -55 dBFS, and 20 broadband clicks of 2-6 ms at -30 to -22 dBFS: ten in the middle of the pauses, ten 20-55
 * ms before an onset.
 */
function buildFixture(): Fixture {
  const random = createRandom(1084);
  const seconds = 8.4;
  const length = Math.round(seconds * RATE);
  const samples = new Float32Array(length);
  // White room tone: uniform noise of RMS 10^(-55/20).
  const roomRms = 10 ** (-55 / 20);
  for (let index = 0; index < length; index++) samples[index] = (random() * 2 - 1) * roomRms * Math.sqrt(3);
  const words: TimeSpan[] = [];
  for (let word = 0; word < 10; word++) {
    const start = 0.5 + word * 0.8;
    const end = start + 0.3;
    words.push({ start, end });
    const fundamental = 140 + word * 13;
    for (let index = Math.round(start * RATE); index < Math.round(end * RATE); index++) {
      const t = index / RATE - start;
      const envelope = Math.min(1, t / 0.01, (end - start - t) / 0.02);
      let tone = 0;
      for (let harmonic = 1; harmonic <= 4; harmonic++) tone += Math.sin(2 * Math.PI * fundamental * harmonic * t) / harmonic;
      samples[index] = (samples[index] ?? 0) + 0.12 * envelope * tone;
    }
  }
  const clicks: TimeSpan[] = [];
  const clickPeaks: number[] = [];
  const addClick = (center: number, duration: number, peakDb: number): void => {
    const from = Math.round((center - duration / 2) * RATE);
    const count = Math.round(duration * RATE);
    const burst = Array.from({ length: count }, (_, index) => (random() * 2 - 1) * Math.sin((Math.PI * (index + 0.5)) / count));
    const scale = 10 ** (peakDb / 20) / Math.max(...burst.map(Math.abs));
    burst.forEach((value, index) => {
      samples[from + index] = (samples[from + index] ?? 0) + value * scale;
    });
    clicks.push({ start: from / RATE, end: (from + count) / RATE });
    clickPeaks.push(Math.max(...Array.from(samples.subarray(from, from + count), Math.abs)));
  };
  words.forEach((word, index) => {
    const duration = 0.002 + (index % 5) * 0.001;
    const peak = -30 + (index % 9);
    // One in the middle of the pause after the word, one before its onset.
    if (index < 9) addClick(word.end + 0.25, duration, peak);
    const before = 0.006 - (index % 5) * 0.001;
    addClick(word.start - 0.02 - (index % 8) * 0.005 - before / 2, before, -22 - (index % 9));
  });
  // The tenth pause click goes before the first word.
  addClick(0.2, 0.004, -26);
  return { samples, words, clicks, clickPeaks };
}

const fixture = buildFixture();

const rms = (samples: Float32Array, from: number, to: number): number => {
  let sum = 0;
  for (let index = from; index < to; index++) sum += (samples[index] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** 50 ms windows inside the pauses, clear of the gate's windows and fades and of every click. */
function getPauseWindows(): [number, number][] {
  const windows = getGateWindows(fixture.words);
  const blocked = [
    ...windows.map((window) => ({ start: window.start - DECLICK_GATE_FADE, end: window.end + DECLICK_GATE_FADE })),
    ...fixture.clicks.map((click) => ({ start: click.start - 0.02, end: click.end + 0.02 })),
  ];
  const found: [number, number][] = [];
  for (let start = 0; start + 0.05 < fixture.samples.length / RATE; start += 0.05) {
    const end = start + 0.05;
    if (blocked.every((span) => end <= span.start || start >= span.end)) found.push([Math.round(start * RATE), Math.round(end * RATE)]);
  }
  return found;
}

describe("getGateWindows", () => {
  it("reaches 40 ms past each word and merges windows whose fades would touch", () => {
    expect(getGateWindows([])).toEqual([]);
    const windows = getGateWindows([
      { start: 1, end: 1.5 },
      { start: 0.02, end: 0.3 },
      // 0.07 s after the first word: windows 0.01 s apart, closer than two fades.
      { start: 1.57, end: 2 },
      { start: 3, end: 3.2 },
    ]);
    expect(windows.map((window) => ({ start: Number(window.start.toFixed(3)), end: Number(window.end.toFixed(3)) }))).toEqual([
      { start: 0, end: 0.34 },
      { start: 0.96, end: 2.04 },
      { start: 2.96, end: 3.24 },
    ]);
    expect(DECLICK_WORD_WINDOW).toBe(0.04);
  });
});

describe("getRunningMedian", () => {
  it("takes the median of the values within reach on each side", () => {
    expect(Array.from(getRunningMedian(Float64Array.from([5, 1, 9, 3, 7]), 1))).toEqual([3, 5, 3, 7, 5]);
    expect(Array.from(getRunningMedian(new Float64Array(0), 3))).toEqual([]);
  });
});

describe("findImpulses", () => {
  it.each<ActiveDeclickLevel>(["gentle", "strong"])("finds every injected click and nothing on the words (%s)", (level) => {
    const impulses = findImpulses(fixture.samples, RATE, fixture.words, level);
    expect(impulses).toHaveLength(fixture.clicks.length);
    for (const click of fixture.clicks) expect(impulses.some((impulse) => impulse.start <= click.start && impulse.end >= click.end)).toBe(true);
    for (const impulse of impulses) expect(fixture.words.every((word) => impulse.end <= word.start || impulse.start >= word.end)).toBe(true);
  });

  it("finds nothing in room tone alone, nor in digital silence", () => {
    const random = createRandom(7);
    const room = Float32Array.from({ length: RATE * 2 }, () => (random() * 2 - 1) * 0.003);
    expect(findImpulses(room, RATE, [], "strong")).toEqual([]);
    expect(findImpulses(new Float32Array(RATE), RATE, [], "strong")).toEqual([]);
  });

  it("leaves a burst longer than 30 ms alone", () => {
    const random = createRandom(9);
    const samples = Float32Array.from({ length: RATE }, () => (random() * 2 - 1) * 0.002);
    for (let index = Math.round(0.5 * RATE); index < Math.round(0.545 * RATE); index++) samples[index] = (random() * 2 - 1) * 0.05;
    expect(findImpulses(samples, RATE, [], "strong")).toEqual([]);
  });
});

describe("declickSamples", () => {
  it.each<ActiveDeclickLevel>(["gentle", "strong"])("gates the pauses, lowers the clicks and keeps every onset (%s)", (level) => {
    const { gateDb } = DECLICK_SETTINGS[level];
    const { samples, report } = declickSamples({ samples: fixture.samples, channels: 1, sampleRate: RATE, words: fixture.words, level });
    expect(report).toEqual({ level, impulses: 20, gateDb });
    // The pauses' median RMS falls by the gate level within 1 dB.
    const pauses = getPauseWindows();
    expect(pauses.length).toBeGreaterThan(20);
    const before = median(pauses.map(([from, to]) => toDb(rms(fixture.samples, from, to))));
    const after = median(pauses.map(([from, to]) => toDb(rms(samples, from, to))));
    expect(Math.abs(after - before - gateDb)).toBeLessThanOrEqual(1);
    expect(before).toBeCloseTo(-55, 0);
    // Every click's peak falls by at least 25 dB.
    fixture.clicks.forEach((click, index) => {
      const from = Math.round(click.start * RATE);
      const to = Math.round(click.end * RATE);
      const peak = Math.max(...Array.from(samples.subarray(from, to), Math.abs));
      expect(toDb(fixture.clickPeaks[index] ?? 0) - toDb(peak)).toBeGreaterThanOrEqual(25);
    });
    // Every word's first 30 ms keep their energy within 0.5 dB.
    for (const word of fixture.words) {
      const from = Math.round(word.start * RATE);
      const to = Math.round((word.start + 0.03) * RATE);
      expect(Math.abs(toDb(rms(samples, from, to)) - toDb(rms(fixture.samples, from, to)))).toBeLessThanOrEqual(0.5);
    }
  });

  it("applies one gain to every channel, and without words gates nothing", () => {
    const random = createRandom(3);
    const length = RATE;
    const stereo = new Float32Array(length * 2);
    for (let index = 0; index < length; index++) {
      const value = (random() * 2 - 1) * 0.002;
      stereo[index * 2] = value;
      stereo[index * 2 + 1] = -value;
    }
    const center = Math.round(0.5 * RATE);
    for (let index = center; index < center + 150; index++) {
      const value = (random() * 2 - 1) * 0.05;
      stereo[index * 2] = value;
      stereo[index * 2 + 1] = value;
    }
    const { samples, report } = declickSamples({ samples: stereo, channels: 2, sampleRate: RATE, words: [], level: "gentle" });
    expect(report).toEqual({ level: "gentle", impulses: 1, gateDb: null });
    // Far from the click, the track is untouched.
    expect(Array.from(samples.subarray(0, 2 * Math.round(0.3 * RATE)))).toEqual(Array.from(stereo.subarray(0, 2 * Math.round(0.3 * RATE))));
    expect(toDb(Math.abs(samples[(center + 75) * 2] ?? 0)) - toDb(Math.abs(stereo[(center + 75) * 2] ?? 0))).toBeCloseTo(-30, 1);
    expect(samples[(center + 75) * 2]).toBe(samples[(center + 75) * 2 + 1]);
  });
});

describe("the stage's ffmpeg steps", () => {
  it("decodes to float PCM and encodes WAV or mp3 by the output's extension", () => {
    expect(buildDeclickDecodeArgs("in.mp3", "raw.f32")).toEqual(["-v", "error", "-y", "-i", "in.mp3", "-vn", "-c:a", "pcm_f32le", "-f", "f32le", "-ar", "48000", "-ac", "2", "raw.f32"]);
    expect(buildDeclickEncodeArgs("raw.f32", "out.wav")).toEqual(["-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", "raw.f32", "-c:a", "pcm_f32le", "out.wav"]);
    expect(buildDeclickEncodeArgs("raw.f32", "out.mp3").slice(-5)).toEqual(["-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });

  it("logs the count and the gate", () => {
    expect(describeDeclick({ level: "gentle", impulses: 12, gateDb: -15 })).toBe("declick (gentle): 12 impulses removed, the pauses lowered by 15 dB.");
    expect(describeDeclick({ level: "strong", impulses: 1, gateDb: null })).toBe("declick (strong): 1 impulse removed, no words, so no gate.");
  });
});

describe("declickSpeech", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  it("runs the stage on a real file through ffmpeg", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-declick-"));
    const pcm = join(dir, "speech.f32");
    const stereo = new Float32Array(fixture.samples.length * 2);
    fixture.samples.forEach((value, index) => {
      stereo[index * 2] = value;
      stereo[index * 2 + 1] = value;
    });
    writeFileSync(pcm, Buffer.from(stereo.buffer));
    const input = join(dir, "speech.wav");
    expect(spawnSync("ffmpeg", buildDeclickEncodeArgs(pcm, input)).status).toBe(0);
    const output = join(dir, "speech.declicked.wav");
    const progress: number[] = [];
    const report = await declickSpeech({ input, output, words: fixture.words.map((word) => ({ text: "word", ...word })), level: "strong", seconds: 8.4, onSeconds: (done) => progress.push(done) });
    expect(report).toEqual({ level: "strong", impulses: 20, gateDb: -20 });
    expect(Math.max(...progress)).toBeLessThanOrEqual(8.4);
    expect(spawnSync("ffmpeg", buildDeclickDecodeArgs(output, pcm)).status).toBe(0);
    const bytes = readFileSync(pcm);
    expect(bytes.length).toBe(stereo.length * 4);
    // A pause, clear of clicks and fades: 20 dB down.
    const from = Math.round(0.9 * RATE);
    const to = Math.round(1 * RATE);
    const read = (index: number): number => bytes.readFloatLE(index * 8);
    let sum = 0;
    for (let index = from; index < to; index++) sum += read(index) ** 2;
    expect(toDb(Math.sqrt(sum / (to - from))) - toDb(rms(fixture.samples, from, to))).toBeCloseTo(-20, 0);
  }, 30_000);
});
