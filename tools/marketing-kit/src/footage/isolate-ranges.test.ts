import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ok } from "../voice/provider.js";
import type { Edl } from "./edl.js";
import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "./fake.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { isolateSpeechRanges, type IsolateSpeechRangesOptions } from "./isolate-ranges.js";
import { estimateFootageFilm, estimateSpeechRanges } from "./paid.js";
import type { PreparedClip } from "./pipeline.js";
import type { FootageProbe } from "./probe.js";
import type { FootageCharge, IsolationProvider } from "./providers.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const PROBE: FootageProbe = { duration: 6, width: 64, height: 64, rotation: 0, displayWidth: 64, displayHeight: 64, codec: "h264", pixelFormat: "yuv420p", colorTransfer: null, hdr: null, hasAudio: true };

/** The loudest sample (dB) of `file` between `start` and `end` seconds. */
function getMaxVolume(file: string, start: number, end: number): number {
  const result = spawnSync("ffmpeg", ["-v", "info", "-ss", String(start), "-t", String(end - start), "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const match = /max_volume: (-?[\d.]+|-inf) dB/.exec(result.stderr);
  if (match?.[1] === undefined) throw new Error(`no volume in ${result.stderr}`);
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}

function probeStream(file: string): { duration: number; channels: number } {
  const result = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels:format=duration", "-of", "json", file], { encoding: "utf8" });
  const json = JSON.parse(result.stdout) as { streams: { channels: number }[]; format: { duration: string } };
  return { duration: Number(json.format.duration), channels: json.streams[0]?.channels ?? 0 };
}

/** Answers silence (mono) as long as its input: the "cleaned" voice is told apart from the clip's tone. */
function createSilencingProvider(dir: string): IsolationProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    id: "silence",
    calls,
    isolate(input) {
      calls.push(input.audio);
      const output = join(dir, `silence-${String(calls.length)}.mp3`);
      const length = probeStream(input.audio).duration;
      spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(length), "-c:a", "libmp3lame", "-q:a", "2", output]);
      return Promise.resolve(ok({ audio: readFileSync(output), credits: 7 }));
    },
  };
}

describe.runIf(hasFfmpeg)("isolateSpeechRanges (issue #1087)", () => {
  let dir: string;
  let lines: string[];
  let clip: PreparedClip;
  let film: FootageFilm;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-ranges-"));
    lines = [];
    const file = join(dir, "talk.mp4");
    const made = spawnSync(
      "ffmpeg",
      ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=6", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6", "-ac", "2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file],
      { encoding: "utf8" },
    );
    if (made.status !== 0) throw new Error(made.stderr);
    clip = { clip: { id: "talk", source: file, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe: PROBE, file, duration: 6 };
    film = {
      id: "street",
      title: "Street",
      format: "9:16",
      language: "en",
      clips: [clip.clip],
      isolateVoice: false,
      cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
      transitions: DEFAULT_TRANSITIONS,
      music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
      captions: false,
      endCard: null,
    };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const edl: Edl = {
    version: 2,
    film: "street",
    segments: [
      { id: "s1", clip: "talk", start: 1, end: 2, transition: "cut", motion: "none" },
      { id: "s2", clip: "talk", start: 4, end: 5, transition: "cut", motion: "none" },
    ],
  };

  function options(isolation: IsolationProvider, changes: Partial<IsolateSpeechRangesOptions> = {}): IsolateSpeechRangesOptions {
    return {
      buildDir: join(dir, "build"),
      cacheDir: join(dir, "cache"),
      providers: { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() },
      isCommit: true,
      margin: 0.2,
      mergeGap: null,
      log: (line) => lines.push(line),
      ...changes,
    };
  }

  it("buys each range once, lays the cleaned windows over the clip's own sound and keeps the clip's length", async () => {
    const isolation = createSilencingProvider(dir);
    const charges: FootageCharge[] = [];
    const result = await isolateSpeechRanges(film, [clip], edl, options(isolation, { onCharge: (charge) => charges.push(charge) }));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.ranges.map(({ startMs, endMs, cached, laid }) => ({ startMs, endMs, cached, laid }))).toEqual([
      { startMs: 800, endMs: 2200, cached: false, laid: true },
      { startMs: 3800, endMs: 5200, cached: false, laid: true },
    ]);
    expect(charges).toEqual([
      { step: "isolate", item: "talk", provider: "silence", units: 1.4, credits: 7, cacheKey: result.value.ranges[0]?.cacheKey, range: { start: 0.8, end: 2.2 } },
      { step: "isolate", item: "talk", provider: "silence", units: 1.4, credits: 7, cacheKey: result.value.ranges[1]?.cacheKey, range: { start: 3.8, end: 5.2 } },
    ]);
    const speech = result.value.speech.talk ?? "";
    expect(speech).toBe(join(dir, "build", "audio", "talk.ranges.mp3"));
    const stream = probeStream(speech);
    expect(stream.channels).toBe(2);
    expect(Math.abs(stream.duration - 6)).toBeLessThan(0.1);
    expect(getMaxVolume(speech, 1, 2)).toBeLessThan(-60);
    expect(getMaxVolume(speech, 4, 5)).toBeLessThan(-60);
    expect(getMaxVolume(speech, 2.5, 3.5)).toBeGreaterThan(-30);
    expect(getMaxVolume(speech, 0, 0.6)).toBeGreaterThan(-30);

    const again = await isolateSpeechRanges(film, [clip], edl, options(isolation, { onCharge: (charge) => charges.push(charge) }));
    if (!again.ok) throw new Error(again.error);
    expect(isolation.calls).toHaveLength(2);
    expect(charges).toHaveLength(2);
    expect(again.value.ranges.every((range) => range.cached && range.laid)).toBe(true);
  });

  it("pays only a changed cut's new range", async () => {
    const isolation = createFakeIsolationProvider();
    await isolateSpeechRanges(film, [clip], edl, options(isolation));
    const moved: Edl = { ...edl, segments: [...edl.segments.slice(0, 1), { id: "s2", clip: "talk", start: 4.5, end: 5.5, transition: "cut", motion: "none" }] };
    const result = await isolateSpeechRanges(film, [clip], moved, options(isolation));
    if (!result.ok) throw new Error(result.error);
    expect(isolation.calls).toHaveLength(3);
    expect(result.value.ranges.map(({ startMs, cached }) => [startMs, cached])).toEqual([
      [800, true],
      [4300, false],
    ]);
  });

  it("without --commit lays only cached ranges and names the rest, paying nothing", async () => {
    const isolation = createFakeIsolationProvider();
    const empty = await isolateSpeechRanges(film, [clip], edl, options(isolation, { isCommit: false }));
    if (!empty.ok) throw new Error(empty.error);
    expect(isolation.calls).toEqual([]);
    expect(empty.value.speech).toEqual({ talk: clip.file });
    expect(empty.value.ranges.map(({ cached, laid }) => [cached, laid])).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(lines.some((line) => line.includes("DRY RUN: 2 ranges (2.8 s) not cached"))).toBe(true);

    await isolateSpeechRanges(film, [clip], { ...edl, segments: edl.segments.slice(0, 1) }, options(isolation));
    const draft = await isolateSpeechRanges(film, [clip], edl, options(isolation, { isCommit: false }));
    if (!draft.ok) throw new Error(draft.error);
    expect(isolation.calls).toHaveLength(1);
    expect(draft.value.ranges.map(({ laid }) => laid)).toEqual([true, false]);
    expect(existsSync(draft.value.speech.talk ?? "")).toBe(true);
    expect(draft.value.speech.talk).not.toBe(clip.file);
  });

  /** Refuses every range whose cut file name contains `refused` `times` times, answering silence otherwise. */
  function createRefusingProvider(refused: string, times: number): IsolationProvider & { calls: string[] } {
    const silencing = createSilencingProvider(dir);
    let refusals = 0;
    return {
      id: "silence",
      get calls() {
        return silencing.calls;
      },
      isolate(input) {
        if (input.audio.includes(refused) && refusals < times) {
          refusals += 1;
          silencing.calls.push(input.audio);
          return Promise.resolve({ ok: false, error: "voice not detected" });
        }
        return silencing.isolate(input);
      },
    };
  }

  const three: Edl = {
    version: 2,
    film: "street",
    segments: [
      { id: "s1", clip: "talk", start: 0.5, end: 1, transition: "cut", motion: "none" },
      { id: "s2", clip: "talk", start: 2.5, end: 3, transition: "cut", motion: "none" },
      { id: "s3", clip: "talk", start: 4.5, end: 5, transition: "cut", motion: "none" },
    ],
  };

  it("lays the ranges it bought when one is refused on every attempt, keeping the clip's own sound in that window only (issue #1127)", async () => {
    const isolation = createRefusingProvider("talk.2300-3200", 3);
    const charges: FootageCharge[] = [];
    const waits: number[] = [];
    const result = await isolateSpeechRanges(
      film,
      [clip],
      three,
      options(isolation, {
        onCharge: (charge) => charges.push(charge),
        retry: { wait: (ms) => (waits.push(ms), Promise.resolve()) },
        chargeItem: (range) => `${range.clip}@${String(range.startMs)}`,
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.ranges.map(({ startMs, laid, outcome }) => ({ startMs, laid, outcome }))).toEqual([
      { startMs: 300, laid: true, outcome: { kind: "bought", attempts: 1 } },
      { startMs: 2300, laid: false, outcome: { kind: "failed", error: "voice not detected", attempts: 3 } },
      { startMs: 4300, laid: true, outcome: { kind: "bought", attempts: 1 } },
    ]);
    expect(isolation.calls).toHaveLength(5);
    expect(waits).toEqual([1000, 2000]);
    expect(charges.map(({ item, range }) => [item, range])).toEqual([
      ["talk@300", { start: 0.3, end: 1.2 }],
      ["talk@4300", { start: 4.3, end: 5.2 }],
    ]);
    expect(existsSync(result.value.ranges[1]?.path ?? "")).toBe(false);
    expect(existsSync(join(dir, "build", "audio", "ranges", "talk.2300-3200.mp3"))).toBe(false);
    const speech = result.value.speech.talk ?? "";
    expect(getMaxVolume(speech, 0.5, 1)).toBeLessThan(-60);
    expect(getMaxVolume(speech, 4.5, 5)).toBeLessThan(-60);
    expect(getMaxVolume(speech, 2.4, 3.1)).toBeGreaterThan(-30);
    expect(lines).toContain("voice isolation: 1 range refused, laid with the clip's own sound: clip talk 2.300-3.200 s.");

    const again = await isolateSpeechRanges(film, [clip], three, options(isolation, { onCharge: (charge) => charges.push(charge), retry: { wait: () => Promise.resolve() } }));
    if (!again.ok) throw new Error(again.error);
    expect(again.value.ranges.map(({ outcome }) => outcome.kind)).toEqual(["cached", "bought", "cached"]);
    expect(charges).toHaveLength(3);
  });

  it("buys a range the provider refuses once on its second attempt", async () => {
    const isolation = createRefusingProvider("talk.800-2200", 1);
    const result = await isolateSpeechRanges(film, [clip], edl, options(isolation, { retry: { attempts: 2, delaysMs: [5], wait: () => Promise.resolve() } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.ranges.map(({ outcome }) => outcome)).toEqual([
      { kind: "bought", attempts: 2 },
      { kind: "bought", attempts: 1 },
    ]);
    expect(lines).toContain("voice isolation: clip talk 0.800-2.200 s refused (attempt 1): voice not detected");
  });

  it("stops at a cancel while it waits to ask a refused range again, writing nothing to the cache", async () => {
    const failing: IsolationProvider = { id: "broken", isolate: () => Promise.resolve({ ok: false, error: "quota exceeded" }) };
    const controller = new AbortController();
    const run = isolateSpeechRanges(film, [clip], edl, options(failing, { signal: controller.signal, retry: { delaysMs: [60_000] } }));
    setTimeout(() => controller.abort(new Error("cancelled by the user")), 50);
    await expect(run).rejects.toThrow("cancelled by the user");
    expect(existsSync(join(dir, "cache"))).toBe(false);
  });

  it("reads and writes each range at the app's own cache path", async () => {
    const isolation = createFakeIsolationProvider();
    const own = join(dir, "own");
    const rangeCache = (range: { startMs: number }): { key: string; path: string } => ({ key: `seg-${String(range.startMs)}`, path: join(own, `${String(range.startMs)}.mp3`) });
    const charges: FootageCharge[] = [];
    const result = await isolateSpeechRanges(film, [clip], edl, options(isolation, { rangeCache, onCharge: (charge) => charges.push(charge) }));
    if (!result.ok) throw new Error(result.error);
    expect(charges.map(({ cacheKey }) => cacheKey)).toEqual(["seg-800", "seg-3800"]);
    expect(existsSync(join(own, "800.mp3"))).toBe(true);
    const providers = { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() };
    const estimate = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates: { transcribe: 0, isolate: 1, music: 0 }, edl, margin: 0.2, mergeGap: null, rangeCache });
    if (!estimate.ok) throw new Error(estimate.error);
    expect(estimate.value.totalCredits).toBe(0);
  });

  it("estimates the cut's uncached ranges, a cached range at 0", async () => {
    const isolation = createFakeIsolationProvider();
    await isolateSpeechRanges(film, [clip], { ...edl, segments: edl.segments.slice(0, 1) }, options(isolation));
    const providers = { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() };
    const rates = { transcribe: 0.5, isolate: 2, music: 4 };
    const estimate = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates, edl, margin: 0.2, mergeGap: null });
    if (!estimate.ok) throw new Error(estimate.error);
    expect(estimate.value).toEqual({
      items: [
        { step: "isolate", item: "talk", provider: "fake", units: 1.4, unit: "seconds", credits: 0, cached: true, range: { start: 0.8, end: 2.2 } },
        { step: "isolate", item: "talk", provider: "fake", units: 1.4, unit: "seconds", credits: 2.8, cached: false, range: { start: 3.8, end: 5.2 } },
      ],
      totalCredits: 2.8,
    });
    const whole = await estimateFootageFilm({ ...film, isolateVoice: true }, { cacheDir: join(dir, "cache"), providers, rates, edl, isolate: "segments", margin: 0.2, mergeGap: null });
    if (!whole.ok) throw new Error(whole.error);
    expect(whole.value.items.map(({ step, units }) => [step, units])).toEqual([
      ["transcribe", 6],
      ["isolate", 1.4],
      ["isolate", 1.4],
    ]);
    const noCut = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates });
    expect(noCut).toEqual({ ok: false, error: "footage film street: isolating segments needs the cut (edl, or edl.json in the build folder)." });
  });

  /** A 64x64 talking clip of a 440 Hz tone, `seconds` long. */
  function makeClip(id: string, seconds: number): PreparedClip {
    const file = join(dir, `${id}.mp4`);
    const made = spawnSync(
      "ffmpeg",
      ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=black:s=64x64:d=${String(seconds)}`, "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${String(seconds)}`, "-ac", "2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file],
      { encoding: "utf8" },
    );
    if (made.status !== 0) throw new Error(made.stderr);
    return { clip: { id, source: file, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe: { ...PROBE, duration: seconds }, file, duration: seconds };
  }

  it("isolates the whole of the issue's film shape with a provider that refuses input under 4.6 s, the estimate equal to the seconds sent (issue #1140)", async () => {
    const long = makeClip("talk", 80);
    const longFilm: FootageFilm = { ...film, clips: [long.clip] };
    // One clip, 14 segments, 6 of them shorter than 4.6 s with their margins, 1.2 s apart.
    const lengths = [5, 3.7, 6, 7, 2.1, 3, 6, 5, 2.1, 7, 6, 5, 1.4, 2.7];
    let start = 1;
    const segments = lengths.map((length, index) => {
      const made = { id: `p${String(index + 1).padStart(2, "0")}`, clip: "talk", start, end: start + length, transition: "cut" as const, motion: "none" as const };
      start += length + 1.2;
      return made;
    });
    expect(segments.filter((one) => one.end - one.start + 0.5 < 4.6)).toHaveLength(6);
    const cut: Edl = { version: 2, film: "street", segments };
    const rates = { transcribe: 0, isolate: 1, music: 0 };
    for (const mergeGap of [undefined, null] as const) {
      const isolation = createFakeIsolationProvider({ minSeconds: 4.6 });
      expect(isolation.minSeconds).toBe(4.6);
      const charges: FootageCharge[] = [];
      const cacheDir = join(dir, `cache-${String(mergeGap)}`);
      const providers = { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() };
      const planning = { margin: 0.25, ...(mergeGap === undefined ? {} : { mergeGap }) };
      const estimate = await estimateSpeechRanges(longFilm, { cacheDir, providers, rates, edl: cut, ...planning });
      if (!estimate.ok) throw new Error(estimate.error);
      const result = await isolateSpeechRanges(longFilm, [long], cut, options(isolation, { cacheDir, ...planning, mergeGap, onCharge: (charge) => charges.push(charge) }));
      if (!result.ok) throw new Error(result.error);
      expect(isolation.refused).toEqual([]);
      expect(result.value.ranges.every((range) => range.outcome.kind === "bought" && range.laid)).toBe(true);
      expect(result.value.ranges).toHaveLength(mergeGap === null ? 14 : 1);
      const sent = charges.reduce((sum, charge) => sum + charge.units, 0);
      const priced = estimate.value.items.reduce((sum, item) => sum + item.units, 0);
      expect(Math.round(priced * 1000)).toBe(Math.round(sent * 1000));
      expect(estimate.value.items.some((item) => item.skipped !== undefined)).toBe(false);
    }
  });

  it("widens a short range with the clip's own context and lays back only the part the cut hears", async () => {
    const silencing = createSilencingProvider(dir);
    const isolation: IsolationProvider & { calls: string[] } = {
      id: "silence",
      minSeconds: 4.6,
      calls: silencing.calls,
      isolate: (input) => (probeStream(input.audio).duration < 4.6 ? Promise.resolve({ ok: false, error: "400 audio_too_short" }) : silencing.isolate(input)),
    };
    const short: Edl = { version: 2, film: "street", segments: [{ id: "s1", clip: "talk", start: 2.5, end: 3, transition: "cut", motion: "none" }] };
    const result = await isolateSpeechRanges(film, [clip], short, options(isolation, { mergeGap: undefined }));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.ranges.map(({ startMs, endMs, heard, outcome }) => ({ startMs, endMs, heard, outcome }))).toEqual([
      { startMs: 250, endMs: 5250, heard: { startMs: 2300, endMs: 3200 }, outcome: { kind: "bought", attempts: 1 } },
    ]);
    const speech = result.value.speech.talk ?? "";
    expect(getMaxVolume(speech, 2.4, 3.1)).toBeLessThan(-60);
    expect(getMaxVolume(speech, 0.4, 2.1)).toBeGreaterThan(-30);
    expect(getMaxVolume(speech, 3.4, 5.1)).toBeGreaterThan(-30);
  });

  it("never sends a range the clip is too short to bring to the minimum: marked skipped, unpriced, no work file", async () => {
    const isolation = createFakeIsolationProvider({ minSeconds: 7 });
    const result = await isolateSpeechRanges(film, [clip], edl, options(isolation, { mergeGap: undefined }));
    if (!result.ok) throw new Error(result.error);
    expect(isolation.calls).toEqual([]);
    expect(result.value.ranges.map(({ startMs, endMs, laid, outcome }) => ({ startMs, endMs, laid, outcome }))).toEqual([
      { startMs: 0, endMs: 6000, laid: false, outcome: { kind: "skipped", reason: "too_short", minSeconds: 7 } },
    ]);
    expect(result.value.speech).toEqual({ talk: clip.file });
    expect(existsSync(join(dir, "build", "audio", "ranges"))).toBe(false);
    expect(lines).toContain("voice isolation: 1 range shorter than fake's minimum of 7 s even with the clip's whole sound, not sent, laid with the clip's own sound: clip talk 0.000-6.000 s.");
    const providers = { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() };
    const estimate = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates: { transcribe: 0, isolate: 2, music: 0 }, edl, margin: 0.2 });
    if (!estimate.ok) throw new Error(estimate.error);
    expect(estimate.value).toEqual({
      items: [{ step: "isolate", item: "talk", provider: "fake", units: 0, unit: "seconds", credits: 0, cached: false, range: { start: 0, end: 6 }, skipped: { reason: "too_short", minSeconds: 7 } }],
      totalCredits: 0,
    });
  });

  it("refuses with the fake an input shorter than its minimum", async () => {
    const isolation = createFakeIsolationProvider({ minSeconds: 7 });
    const answer = await isolation.isolate({ audio: clip.file });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error).toMatch(/^fake voice isolation: 400 audio_too_short \(6\.\d{3} s, the minimum is 7 s\)\.$/);
    expect(isolation.refused).toEqual([clip.file]);
    expect((await createFakeIsolationProvider({ minSeconds: 5 }).isolate({ audio: clip.file })).ok).toBe(true);
  });

  it("reads a broken cached range as an error naming the file", async () => {
    const isolation = createFakeIsolationProvider();
    const first = await isolateSpeechRanges(film, [clip], edl, options(isolation));
    if (!first.ok) throw new Error(first.error);
    const broken = first.value.ranges[0]?.path ?? "";
    writeFileSync(broken, "not audio");
    const result = await isolateSpeechRanges(film, [clip], edl, options(isolation));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(`the cleaned voice at ${broken} does not read`);
  });
});
