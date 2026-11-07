import { describe, expect, it } from "vitest";

import { DECLICK_CROSSFADE, DECLICK_REPAIR_RULES, declickSamples, describeDeclick } from "./declick.js";
import { MOUTH_CLICK_RULES, analyzeMouthClicks, findClickCandidates, findMouthClicks } from "./mouth-clicks.js";
import type { TimeSpan } from "./sound-analysis.js";

const RATE = 48_000;

/** A seeded generator, so every run builds the same fixture. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** A builder of test sound: room tone at about -55 dBFS, words, clicks, tones and noise. */
function createSound(seconds: number, seed: number) {
  const random = createRandom(seed);
  const roomRms = 10 ** (-55 / 20);
  const samples = Float32Array.from({ length: Math.round(seconds * RATE) }, () => (random() * 2 - 1) * roomRms * Math.sqrt(3));
  const words: TimeSpan[] = [];
  const at = (time: number): number => Math.round(time * RATE);
  return {
    samples,
    words,
    /**
     * A tonal word at -23 dBFS whose transcript span is `start` to `end`; its sound starts `lead` seconds earlier (a
     * linear rise) and decays for `decay` seconds after (15 ms time constant). Without lead and decay, 2 ms ramps.
     */
    addWord(start: number, end: number, sound: { lead?: number; decay?: number } = {}): void {
      const lead = sound.lead ?? 0;
      const decay = sound.decay ?? 0;
      words.push({ start, end });
      for (let index = at(start - lead); index < at(end + decay); index++) {
        const t = index / RATE;
        const rise = lead > 0 ? Math.min(1, (t - start + lead) / lead) : Math.min(1, (t - start) / 0.002);
        const fall = decay > 0 ? (t > end ? Math.exp(-(t - end) / 0.015) : 1) : Math.min(1, (end - t) / 0.002);
        samples[index] = (samples[index] ?? 0) + 0.1 * Math.sqrt(2) * Math.max(0, Math.min(rise, fall)) * Math.sin(2 * Math.PI * 180 * t);
      }
    },
    /** A broadband click of `duration` seconds centred on `center`, under a half-sine envelope peaking at `peak`. */
    addClick(center: number, duration = 0.003, peak = 0.1): TimeSpan {
      const from = at(center - duration / 2);
      const count = at(duration);
      for (let index = 0; index < count; index++) samples[from + index] = (samples[from + index] ?? 0) + (random() * 2 - 1) * peak * Math.sin((Math.PI * (index + 0.5)) / count);
      return { start: from / RATE, end: (from + count) / RATE };
    },
    /** Rectangular white noise of the given RMS from `start` to `end` (a breath, a burst). */
    addNoise(start: number, end: number, rms: number): void {
      for (let index = at(start); index < at(end); index++) samples[index] = (samples[index] ?? 0) + (random() * 2 - 1) * rms * Math.sqrt(3);
    },
    /** A sine of `frequency` from `start` to `end` with 1 ms ramps. */
    addTone(start: number, end: number, frequency: number, amplitude: number): void {
      for (let index = at(start); index < at(end); index++) {
        const t = index / RATE;
        samples[index] = (samples[index] ?? 0) + amplitude * Math.min(1, (t - start) / 0.001, (end - t) / 0.001) * Math.sin(2 * Math.PI * frequency * t);
      }
    },
  };
}

const covers = (spans: readonly TimeSpan[], click: TimeSpan): boolean => spans.some((span) => span.start <= click.start && span.end >= click.end);

/** The mean square of the samples in dB. */
function getEnergyDb(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let index = Math.round(from * RATE); index < Math.round(to * RATE); index++) sum += (samples[index] ?? 0) ** 2;
  return 10 * Math.log10(sum / (Math.round(to * RATE) - Math.round(from * RATE)));
}

describe("MOUTH_CLICK_RULES", () => {
  it("holds the rules of issues #1182 and #1183", () => {
    expect(MOUTH_CLICK_RULES).toMatchObject({
      minSeconds: 0.001,
      maxSeconds: 0.025,
      bandLowHz: 2000,
      bandHighHz: 10_000,
      jumpDb: 12,
      medianSeconds: 0.05,
      maxCorrelation: 0.3,
      minLagSeconds: 0.0025,
      maxLagSeconds: 0.015,
      correlationSeconds: 0.03,
      afterSeconds: 0.01,
      afterDropDb: 12,
      energySeconds: 0.01,
      wordDropDb: 20,
      wordGuardSeconds: 0.08,
      loudDbfs: -45,
    });
    expect(DECLICK_REPAIR_RULES).toEqual({ minPauseSeconds: 0.15, maxRepairSeconds: 0.025, maxPerSecond: 3, maxShare: 0.01 });
  });
});

describe("findClickCandidates (the impulse rule)", () => {
  it("finds a short broadband click in room tone", () => {
    const sound = createSound(2, 1);
    const click = sound.addClick(1, 0.003);
    const candidates = findClickCandidates(sound.samples, RATE);
    expect(candidates).toHaveLength(1);
    expect(covers(candidates, click)).toBe(true);
  });

  it("leaves a periodic 10 ms 3 kHz tone and keeps a noise burst of the same length", () => {
    const tone = createSound(2, 2);
    tone.addTone(1, 1.01, 3000, 0.05);
    expect(findClickCandidates(tone.samples, RATE)).toEqual([]);
    const noise = createSound(2, 2);
    noise.addNoise(1, 1.01, 0.035);
    expect(findClickCandidates(noise.samples, RATE)).toHaveLength(1);
  });

  it("leaves bursts longer than 25 ms (a 30 ms and a 120 ms noise burst)", () => {
    const sound = createSound(3, 3);
    sound.addNoise(0.8, 0.83, 0.03);
    sound.addNoise(1.8, 1.92, 0.03);
    expect(findClickCandidates(sound.samples, RATE)).toEqual([]);
  });

  it("leaves a burst whose sound goes on within 12 dB of its peak (the onset of a breath or a fricative)", () => {
    const roomRms = 10 ** (-55 / 20);
    const alone = createSound(2, 4);
    alone.addNoise(1, 1.004, roomRms * 10 ** (16 / 20));
    expect(findClickCandidates(alone.samples, RATE)).toHaveLength(1);
    const onset = createSound(2, 4);
    onset.addNoise(1, 1.004, roomRms * 10 ** (16 / 20));
    onset.addNoise(1.004, 1.034, roomRms * 10 ** (8 / 20));
    expect(findClickCandidates(onset.samples, RATE)).toEqual([]);
  });

  it("finds nothing in digital silence with a stray bit (the band floor)", () => {
    const silence = new Float32Array(RATE);
    silence[RATE / 2] = 1 / 32_768;
    expect(findClickCandidates(silence, RATE)).toEqual([]);
    expect(findMouthClicks({ mono: silence, sampleRate: RATE, offset: 0, words: [{ start: 0.1, end: 0.2 }] }).clicks).toEqual([]);
  });
});

describe("findMouthClicks (stage A, issue #1182)", () => {
  it("widens each word's bound to its sound by energy and protects 80 ms beyond it", () => {
    const sound = createSound(2.5, 5);
    sound.addWord(1, 1.3, { lead: 0.03, decay: 0.06 });
    // 100 ms before the transcript start and after its end: inside the energy zone, outside the transcript's guard.
    const nearStart = sound.addClick(0.9);
    const nearEnd = sound.addClick(1.4);
    const farStart = sound.addClick(0.7);
    const farEnd = sound.addClick(1.55);
    const found = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words });
    const [bound] = found.words;
    expect(found.words).toHaveLength(1);
    expect(bound?.start).toBeGreaterThan(0.96);
    expect(bound?.start).toBeLessThan(0.98);
    expect(bound?.end).toBeGreaterThan(1.32);
    expect(bound?.end).toBeLessThan(1.36);
    expect(covers(found.clicks, nearStart)).toBe(false);
    expect(covers(found.clicks, nearEnd)).toBe(false);
    expect(covers(found.clicks, farStart)).toBe(true);
    expect(covers(found.clicks, farEnd)).toBe(true);
    expect(found.clicks).toHaveLength(2);
  });

  it("keeps the transcript's bound where the sound lies inside it", () => {
    const sound = createSound(1, 6);
    sound.addWord(0.4, 0.6);
    sound.samples.fill(0, Math.round(0.4 * RATE), Math.round(0.45 * RATE));
    const [bound] = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words }).words;
    expect(bound).toEqual({ start: 0.4, end: 0.6 });
  });

  it("measures the -45 dBFS rule with the click's own samples left out", () => {
    const sound = createSound(2, 7);
    sound.addWord(0.3, 0.5);
    const click = sound.addClick(1.5, 0.003, 0.1);
    // The click's own 10 ms window is far above -45 dBFS.
    expect(getEnergyDb(sound.samples, 1.495, 1.505)).toBeGreaterThan(-45);
    const found = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words });
    expect(found.clicks).toHaveLength(1);
    expect(covers(found.clicks, click)).toBe(true);
    expect(found.isQuiet({ start: 1.4, end: 1.6 })).toBe(true);
    expect(found.isQuiet({ start: 0.35, end: 0.45 })).toBe(false);
  });

  it("protects a click next to a -40 dBFS breath and reports the breath as not quiet", () => {
    const sound = createSound(2, 8);
    sound.addWord(0.2, 0.4);
    sound.addNoise(1, 1.2, 10 ** (-40 / 20));
    const click = sound.addClick(1.2035);
    expect(covers(analyzeMouthClicks(sound.samples, RATE, sound.words).candidates, click)).toBe(true);
    const found = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words });
    expect(covers(found.clicks, click)).toBe(false);
    expect(found.isQuiet({ start: 1.05, end: 1.15 })).toBe(false);
    expect(found.isQuiet({ start: 1.3, end: 1.6 })).toBe(true);
  });

  it("works in the film's time when the stretch starts at an offset", () => {
    const sound = createSound(2.5, 5);
    sound.addWord(1, 1.3, { lead: 0.03, decay: 0.06 });
    const click = sound.addClick(0.7);
    const local = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words });
    const shifted = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 10, words: sound.words.map((word) => ({ start: word.start + 10, end: word.end + 10 })) });
    expect(shifted.clicks).toHaveLength(local.clicks.length);
    shifted.clicks.forEach((span, index) => expect(span.start - 10).toBeCloseTo(local.clicks[index]?.start ?? 0, 9));
    expect(shifted.words[0]?.start).toBeCloseTo((local.words[0]?.start ?? 0) + 10, 9);
    expect(covers(shifted.clicks, { start: click.start + 10, end: click.end + 10 })).toBe(true);
    expect(shifted.isQuiet({ start: 10.6, end: 10.8 })).toBe(true);
    expect(shifted.isQuiet({ start: 11.05, end: 11.2 })).toBe(false);
  });
});

/** The sample indexes the stage changed. */
function getChangedIndexes(before: Float32Array, after: Float32Array): number[] {
  const changed: number[] = [];
  for (let index = 0; index < before.length; index++) if (before[index] !== after[index]) changed.push(index);
  return changed;
}

const isUnchanged = (before: Float32Array, after: Float32Array, span: TimeSpan): boolean => {
  for (let index = Math.round(span.start * RATE); index < Math.round(span.end * RATE); index++) if (before[index] !== after[index]) return false;
  return true;
};

const repair = (samples: Float32Array, words: readonly TimeSpan[]) => declickSamples({ samples, channels: 1, sampleRate: RATE, words, level: "repair" });

describe("the declick repair level (stage B, issue #1183)", () => {
  it("repairs a click in a pause of 151 ms after the guard and leaves one in a 140 ms pause", () => {
    const build = (pause: number) => {
      const sound = createSound(2, 9);
      sound.addWord(0.3, 0.6);
      const nextStart = 0.6 + 0.08 + pause + 0.08;
      sound.addWord(nextStart, nextStart + 0.3);
      const click = sound.addClick(0.68 + pause / 2);
      return { sound, click };
    };
    const long = build(0.151);
    const repaired = repair(long.sound.samples, long.sound.words);
    expect(repaired.report.impulses).toBe(1);
    expect(covers(repaired.report.repairs, long.click)).toBe(true);
    const short = build(0.14);
    const left = repair(short.sound.samples, short.sound.words);
    expect(left.report).toEqual({ level: "repair", impulses: 0, repairs: [], skippedLimit: 0 });
    expect(Array.from(left.samples)).toEqual(Array.from(short.sound.samples));
  });

  it("leaves a click inside a decay the transcript cut short, which the 0.18.0 levels repair", () => {
    const sound = createSound(2.5, 10);
    sound.addWord(0.3, 0.6, { decay: 0.06 });
    sound.addWord(2, 2.3);
    const inDecayZone = sound.addClick(0.7);
    const inPause = sound.addClick(1.2);
    const { samples, report } = repair(sound.samples, sound.words);
    expect(isUnchanged(sound.samples, samples, inDecayZone)).toBe(true);
    expect(covers(report.repairs, inPause)).toBe(true);
    expect(report.impulses).toBe(1);
    expect(covers(declickSamples({ samples: sound.samples, channels: 1, sampleRate: RATE, words: sound.words, level: "gentle" }).report.repairs, inDecayZone)).toBe(true);
  });

  it("leaves a click next to a -40 dBFS breath and repairs the same click without it", () => {
    const build = (isBreath: boolean) => {
      const sound = createSound(2.5, 11);
      sound.addWord(0.2, 0.4);
      sound.addWord(2, 2.3);
      if (isBreath) sound.addNoise(1, 1.2, 10 ** (-40 / 20));
      const click = sound.addClick(1.2035);
      return { sound, click };
    };
    const breath = build(true);
    expect(repair(breath.sound.samples, breath.sound.words).report.impulses).toBe(0);
    const plain = build(false);
    expect(covers(repair(plain.sound.samples, plain.sound.words).report.repairs, plain.click)).toBe(true);
  });

  it("repairs 3 of 5 clicks in one second and reports 2 skipped", () => {
    const sound = createSound(10, 12);
    sound.addWord(0.2, 0.4);
    sound.addWord(9, 9.3);
    const clicks = [1, 1.2, 1.4, 1.6, 1.8].map((center) => sound.addClick(center));
    const { report } = repair(sound.samples, sound.words);
    expect(report.impulses).toBe(3);
    expect(report.skippedLimit).toBe(2);
    expect(clicks.map((click) => covers(report.repairs, click))).toEqual([true, true, true, false, false]);
    expect(describeDeclick(report)).toBe(
      "declick (repair): 3 impulses repaired at 0.996 s, 1.197 s, 1.396 s, 2 left over the limits; no gain change, nothing within 80 ms of a word's sound or above -45 dBFS touched.",
    );
  });

  it("keeps all repairs with their crossfades within 1 % of the track", () => {
    const sound = createSound(3, 13);
    sound.addWord(0.1, 0.3);
    const clicks = [0.9, 1.3, 1.7].map((center) => sound.addClick(center));
    const { report } = repair(sound.samples, sound.words);
    const used = report.repairs.reduce((sum, span) => sum + span.end - span.start + 2 * DECLICK_CROSSFADE, 0);
    expect(used).toBeLessThanOrEqual(0.03);
    expect(report.impulses).toBe(2);
    expect(report.skippedLimit).toBe(1);
    expect(clicks.map((click) => covers(report.repairs, click))).toEqual([true, true, false]);
  });

  it("leaves a periodic 10 ms tone and a track without words", () => {
    const sound = createSound(2.5, 14);
    sound.addWord(0.2, 0.4);
    sound.addWord(2, 2.3);
    sound.addTone(1, 1.01, 3000, 0.05);
    expect(repair(sound.samples, sound.words).report.impulses).toBe(0);
    const unspoken = createSound(2, 15);
    unspoken.addClick(1);
    const { samples, report } = repair(unspoken.samples, []);
    expect(report).toEqual({ level: "repair", impulses: 0, repairs: [], skippedLimit: 0 });
    expect(Array.from(samples)).toEqual(Array.from(unspoken.samples));
  });

  it("on speech whose transcript bounds sit 20-60 ms inside the sound, changes only the repairs and none in the energy zone", () => {
    // 12 s, so the 1 % budget (120 ms) holds every pause click.
    const sound = createSound(12, 1183);
    const clicks: TimeSpan[] = [];
    for (let word = 0; word < 8; word++) {
      const start = 0.5 + word * 0.9;
      const end = start + 0.3;
      sound.addWord(start, end, { lead: 0.02 + (word % 3) * 0.01, decay: 0.04 + (word % 2) * 0.02 });
      // One click 100 ms past the transcript's end (in the energy zone), one in the middle of the pause.
      clicks.push(sound.addClick(end + 0.1), sound.addClick(end + 0.3));
    }
    const { samples, report } = repair(sound.samples, sound.words);
    expect(report.impulses).toBe(8);
    expect(report.skippedLimit).toBe(0);
    const crossfade = Math.round(DECLICK_CROSSFADE * RATE);
    const inRepair = (index: number): boolean => report.repairs.some((span) => index >= Math.round(span.start * RATE) - crossfade && index < Math.round(span.end * RATE) + crossfade);
    expect(getChangedIndexes(sound.samples, samples).every(inRepair)).toBe(true);
    const { words } = findMouthClicks({ mono: sound.samples, sampleRate: RATE, offset: 0, words: sound.words });
    for (const span of report.repairs) {
      for (const bound of words) expect(span.end + DECLICK_CROSSFADE <= bound.start - 0.08 || span.start - DECLICK_CROSSFADE >= bound.end + 0.08).toBe(true);
    }
    clicks.forEach((click, index) => expect(covers(report.repairs, click)).toBe(index % 2 === 1));
  });
});
