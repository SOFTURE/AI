import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DECLICK_CROSSFADE,
  DECLICK_WORD_GUARD,
  buildDeclickDecodeArgs,
  buildDeclickEncodeArgs,
  declickSamples,
  declickSpeech,
  describeDeclick,
  findImpulses,
  getArPolynomial,
  getRepairZones,
  getRunningMedian,
  repairSpan,
  type DetectorDeclickLevel,
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

/** The clicks in the middle of a pause (the stage repairs them) and those within 80 ms of an onset (it leaves them). */
const isInPause = (click: TimeSpan): boolean => getRepairZones(fixture.words, 8.4).some((zone) => click.start - DECLICK_CROSSFADE - 0.001 >= zone.start && click.end + DECLICK_CROSSFADE + 0.001 <= zone.end);
const pauseClicks = fixture.clicks.filter(isInPause);
const onsetClicks = fixture.clicks.filter((click) => !isInPause(click));

describe("getRepairZones", () => {
  it("keeps 80 ms clear of every word, leaves the track's edges open and has no zone without words", () => {
    expect(getRepairZones([], 5)).toEqual([]);
    const zones = getRepairZones(
      [
        { start: 1, end: 1.5 },
        { start: 0.05, end: 0.3 },
        // 150 ms after the first word: the guards meet, no zone between them.
        { start: 1.65, end: 2 },
        { start: 3, end: 3.2 },
      ],
      4,
    );
    expect(zones.map((zone) => ({ start: Number(zone.start.toFixed(3)), end: Number(zone.end.toFixed(3)) }))).toEqual([
      { start: 0.38, end: 0.92 },
      { start: 2.08, end: 2.92 },
      { start: 3.28, end: 4 },
    ]);
    expect(getRepairZones([{ start: 0.5, end: 1 }], 2)[0]).toEqual({ start: 0, end: 0.42 });
    expect(DECLICK_WORD_GUARD).toBe(0.08);
  });
});

describe("getRunningMedian", () => {
  it("takes the median of the values within reach on each side", () => {
    expect(Array.from(getRunningMedian(Float64Array.from([5, 1, 9, 3, 7]), 1))).toEqual([3, 5, 3, 7, 5]);
    expect(Array.from(getRunningMedian(new Float64Array(0), 3))).toEqual([]);
  });
});

describe("findImpulses", () => {
  it.each<DetectorDeclickLevel>(["gentle", "strong"])("finds every click in the pauses and none within 80 ms of a word (%s)", (level) => {
    const impulses = findImpulses(fixture.samples, RATE, fixture.words, level);
    expect(pauseClicks.length).toBe(10);
    expect(impulses).toHaveLength(pauseClicks.length);
    for (const click of pauseClicks) expect(impulses.some((impulse) => impulse.start <= click.start && impulse.end >= click.end)).toBe(true);
    for (const impulse of impulses) expect(fixture.words.every((word) => impulse.end <= word.start - DECLICK_WORD_GUARD || impulse.start >= word.end + DECLICK_WORD_GUARD)).toBe(true);
  });

  it("finds nothing without words, in room tone alone, nor in digital silence", () => {
    const random = createRandom(7);
    const room = Float32Array.from({ length: RATE * 2 }, () => (random() * 2 - 1) * 0.003);
    room[RATE] = 0.3;
    expect(findImpulses(room, RATE, [], "strong")).toEqual([]);
    room[RATE] = 0;
    expect(findImpulses(room, RATE, [{ start: 0.1, end: 0.2 }], "strong")).toEqual([]);
    expect(findImpulses(new Float32Array(RATE), RATE, [{ start: 0.1, end: 0.2 }], "strong")).toEqual([]);
  });

  it("leaves a burst of 12 ms or longer alone", () => {
    const random = createRandom(9);
    const samples = Float32Array.from({ length: RATE }, () => (random() * 2 - 1) * 0.002);
    for (let index = Math.round(0.5 * RATE); index < Math.round(0.515 * RATE); index++) samples[index] = (random() * 2 - 1) * 0.05;
    expect(findImpulses(samples, RATE, [{ start: 0.05, end: 0.1 }], "strong")).toEqual([]);
  });
});

describe("repairSpan", () => {
  it("interpolates a tone through a click within -30 dB of the clean tone", () => {
    const clean = Float64Array.from({ length: RATE / 10 }, (_, index) => 0.1 * Math.sin((2 * Math.PI * 220 * index) / RATE) + 0.05 * Math.sin((2 * Math.PI * 660 * index) / RATE));
    const channel = Float64Array.from(clean);
    const from = 2400;
    const to = 2400 + 384;
    const random = createRandom(5);
    for (let index = from + 144; index < to - 144; index++) channel[index] = (random() * 2 - 1) * 0.3;
    repairSpan({ channel, from, to, crossfade: 144, context: 480 });
    let error = 0;
    let power = 0;
    for (let index = from; index < to; index++) {
      error += ((channel[index] ?? 0) - (clean[index] ?? 0)) ** 2;
      power += (clean[index] ?? 0) ** 2;
    }
    expect(toDb(Math.sqrt(error / power))).toBeLessThan(-30);
    expect(Array.from(channel.subarray(0, from))).toEqual(Array.from(clean.subarray(0, from)));
    expect(Array.from(channel.subarray(to))).toEqual(Array.from(clean.subarray(to)));
  });

  it("fits no model on a context too short, and a stable one on silence", () => {
    expect(Array.from(getArPolynomial([new Float64Array(1)], 24))).toEqual([1]);
    expect(Array.from(getArPolynomial([new Float64Array(100), new Float64Array(3)], 4)).map(Math.abs)).toEqual([1, 0, 0, 0, 0]);
  });
});

/** Each sample index the stage changed. */
function getChangedIndexes(before: Float32Array, after: Float32Array): number[] {
  const changed: number[] = [];
  for (let index = 0; index < before.length; index++) if (before[index] !== after[index]) changed.push(index);
  return changed;
}

describe("declickSamples", () => {
  it.each<DetectorDeclickLevel>(["gentle", "strong"])("repairs the clicks in the pauses, keeps those near the words and changes nothing else (%s)", (level) => {
    const { samples, report } = declickSamples({ samples: fixture.samples, channels: 1, sampleRate: RATE, words: fixture.words, level });
    expect(report.level).toBe(level);
    expect(report.impulses).toBe(10);
    expect(report.repairs).toHaveLength(10);
    // Every pause click's peak falls by at least 20 dB.
    for (const click of pauseClicks) {
      const index = fixture.clicks.indexOf(click);
      const from = Math.round(click.start * RATE);
      const to = Math.round(click.end * RATE);
      const peak = Math.max(...Array.from(samples.subarray(from, to), Math.abs));
      expect(toDb(fixture.clickPeaks[index] ?? 0) - toDb(peak)).toBeGreaterThanOrEqual(20);
    }
    // A click within 80 ms of an onset is left as it is.
    for (const click of onsetClicks) {
      const from = Math.round(click.start * RATE);
      const to = Math.round(click.end * RATE);
      expect(Array.from(samples.subarray(from, to))).toEqual(Array.from(fixture.samples.subarray(from, to)));
    }
    // Only the repairs with their crossfades differ from the input.
    const crossfade = Math.round(DECLICK_CROSSFADE * RATE);
    const inRepair = (index: number): boolean => report.repairs.some((repair) => index >= Math.round(repair.start * RATE) - crossfade && index < Math.round(repair.end * RATE) + crossfade);
    expect(getChangedIndexes(fixture.samples, samples).every(inRepair)).toBe(true);
  });

  it("repairs one span on every channel and leaves a track without words as it is", () => {
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
    const plain = declickSamples({ samples: stereo, channels: 2, sampleRate: RATE, words: [], level: "strong" });
    expect(plain.report).toEqual({ level: "strong", impulses: 0, repairs: [], skippedLimit: 0 });
    expect(Array.from(plain.samples)).toEqual(Array.from(stereo));
    const { samples, report } = declickSamples({ samples: stereo, channels: 2, sampleRate: RATE, words: [{ start: 0.05, end: 0.1 }], level: "gentle" });
    expect(report.impulses).toBe(1);
    const left = Math.abs(samples[(center + 75) * 2] ?? 0);
    const right = Math.abs(samples[(center + 75) * 2 + 1] ?? 0);
    expect(toDb(left) - toDb(Math.abs(stereo[(center + 75) * 2] ?? 0))).toBeLessThan(-20);
    expect(right).toBeLessThan(0.01);
    // Far from the click, the track is untouched.
    expect(Array.from(samples.subarray(0, 2 * Math.round(0.4 * RATE)))).toEqual(Array.from(stereo.subarray(0, 2 * Math.round(0.4 * RATE))));
  });
});

describe("the stage's ffmpeg steps", () => {
  it("decodes to float PCM and encodes WAV or mp3 by the output's extension", () => {
    expect(buildDeclickDecodeArgs("in.mp3", "raw.f32")).toEqual(["-v", "error", "-y", "-i", "in.mp3", "-vn", "-c:a", "pcm_f32le", "-f", "f32le", "-ar", "48000", "-ac", "2", "raw.f32"]);
    expect(buildDeclickEncodeArgs("raw.f32", "out.wav")).toEqual(["-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", "raw.f32", "-c:a", "pcm_f32le", "out.wav"]);
    expect(buildDeclickEncodeArgs("raw.f32", "out.mp3").slice(-5)).toEqual(["-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });

  it("logs the count and the first repair times", () => {
    const repairs = Array.from({ length: 10 }, (_, index) => ({ start: index + 0.25, end: index + 0.254 }));
    expect(describeDeclick({ level: "gentle", impulses: 10, repairs, skippedLimit: 0 })).toBe(
      "declick (gentle): 10 impulses repaired at 0.250 s, 1.250 s, 2.250 s, 3.250 s, 4.250 s, 5.250 s, 6.250 s, 7.250 s, +2 more; no gain change, nothing within 80 ms of a word touched.",
    );
    expect(describeDeclick({ level: "strong", impulses: 1, repairs: [{ start: 1.5, end: 1.505 }], skippedLimit: 0 })).toBe(
      "declick (strong): 1 impulse repaired at 1.500 s; no gain change, nothing within 80 ms of a word touched.",
    );
    expect(describeDeclick({ level: "strong", impulses: 0, repairs: [], skippedLimit: 0 })).toBe("declick (strong): 0 impulses repaired; no gain change, nothing within 80 ms of a word touched.");
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("declickSpeech with ffmpeg", () => {
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
    expect(report.impulses).toBe(10);
    expect(Math.max(...progress)).toBeLessThanOrEqual(8.4);
    expect(spawnSync("ffmpeg", buildDeclickDecodeArgs(output, pcm)).status).toBe(0);
    const bytes = readFileSync(pcm);
    expect(bytes.length).toBe(stereo.length * 4);
    // The speech outside the repairs comes back as it went in (float WAV is lossless).
    const read = (index: number): number => bytes.readFloatLE(index * 8);
    for (let index = Math.round(0.4 * RATE); index < Math.round(0.9 * RATE); index++) expect(read(index)).toBe(fixture.samples[index]);
  }, 30_000);
});

/** Words whose sound starts 30 ms before and decays 60 ms past the transcript span. */
function buildSpeech(): { samples: Float32Array; words: TimeSpan[] } {
  const random = createRandom(1170);
  const samples = Float32Array.from({ length: Math.round(6 * RATE) }, () => (random() * 2 - 1) * 0.003);
  const words: TimeSpan[] = [];
  for (let word = 0; word < 8; word++) {
    const start = 0.4 + word * 0.7;
    const end = start + 0.25;
    words.push({ start, end });
    for (let index = Math.round((start - 0.03) * RATE); index < Math.round((end + 0.06) * RATE); index++) {
      const t = index / RATE;
      const envelope = t < start ? (t - start + 0.03) / 0.03 : t > end ? Math.exp(-(t - end) / 0.015) : 1;
      samples[index] = (samples[index] ?? 0) + 0.1 * envelope * Math.sin(2 * Math.PI * 180 * t);
    }
  }
  return { samples, words };
}

describe("the declick inside word windows (issue #1170)", () => {
  it.each<DetectorDeclickLevel>(["gentle", "strong"])("keeps the 5 ms envelope within 1 dB in 99.9 %% of frames (%s)", (level) => {
    const { samples, words } = buildSpeech();
    const output = declickSamples({ samples, channels: 1, sampleRate: RATE, words, level }).samples;
    const frame = Math.round(0.005 * RATE);
    const db = (values: Float32Array, from: number): number => {
      let sum = 0;
      for (let index = from; index < from + frame; index++) sum += (values[index] ?? 0) ** 2;
      return 10 * Math.log10(Math.max(sum / frame, 1e-20));
    };
    let frames = 0;
    let off = 0;
    for (const word of words) {
      for (let from = Math.round((word.start - 0.08) * RATE); from + frame <= Math.round((word.end + 0.08) * RATE); from += frame) {
        frames++;
        if (Math.abs(db(output, from) - db(samples, from)) > 1) off++;
      }
    }
    expect(frames).toBeGreaterThan(400);
    expect(off / frames).toBeLessThanOrEqual(0.001);
  });
});
