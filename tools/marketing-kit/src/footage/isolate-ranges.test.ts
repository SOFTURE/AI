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

  it("fails naming the range when the provider fails, writing nothing to the cache", async () => {
    const failing: IsolationProvider = { id: "broken", isolate: () => Promise.resolve({ ok: false, error: "quota exceeded" }) };
    const result = await isolateSpeechRanges(film, [clip], edl, options(failing));
    expect(result).toEqual({ ok: false, error: "clip talk 0.800-2.200 s: quota exceeded", failure: { kind: "process" } });
    expect(existsSync(join(dir, "cache"))).toBe(false);
  });

  it("estimates the cut's uncached ranges, a cached range at 0", async () => {
    const isolation = createFakeIsolationProvider();
    await isolateSpeechRanges(film, [clip], { ...edl, segments: edl.segments.slice(0, 1) }, options(isolation));
    const providers = { stt: createFakeSttProvider(), isolation, music: createFakeMusicProvider() };
    const rates = { transcribe: 0.5, isolate: 2, music: 4 };
    const estimate = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates, edl, margin: 0.2 });
    if (!estimate.ok) throw new Error(estimate.error);
    expect(estimate.value).toEqual({
      items: [
        { step: "isolate", item: "talk", provider: "fake", units: 1.4, unit: "seconds", credits: 0, cached: true, range: { start: 0.8, end: 2.2 } },
        { step: "isolate", item: "talk", provider: "fake", units: 1.4, unit: "seconds", credits: 2.8, cached: false, range: { start: 3.8, end: 5.2 } },
      ],
      totalCredits: 2.8,
    });
    const whole = await estimateFootageFilm({ ...film, isolateVoice: true }, { cacheDir: join(dir, "cache"), providers, rates, edl, isolate: "segments", margin: 0.2 });
    if (!whole.ok) throw new Error(whole.error);
    expect(whole.value.items.map(({ step, units }) => [step, units])).toEqual([
      ["transcribe", 6],
      ["isolate", 1.4],
      ["isolate", 1.4],
    ]);
    const noCut = await estimateSpeechRanges(film, { cacheDir: join(dir, "cache"), providers, rates });
    expect(noCut).toEqual({ ok: false, error: "footage film street: isolating segments needs the cut (edl, or edl.json in the build folder)." });
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
