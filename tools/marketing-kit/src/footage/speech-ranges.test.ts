import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Edl, EdlSegment } from "./edl.js";
import {
  buildRangeAudioArgs,
  buildRangeLayArgs,
  getSpeechRangeCache,
  getSpeechRangeFades,
  getSpeechRangeWindows,
  planSpeechRanges,
  type SpeechRange,
  type SpeechRangeClip,
} from "./speech-ranges.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const segment = (id: string, clip: string, start: number, end: number, changes: Partial<EdlSegment> = {}): EdlSegment => ({ id, clip, start, end, transition: "cut", motion: "none", ...changes });
const edlOf = (...segments: EdlSegment[]): Edl => ({ version: 2, film: "street", segments });
const CLIPS: SpeechRangeClip[] = [
  { id: "a", role: "talk", duration: 10 },
  { id: "b", role: "talk", duration: 6 },
  { id: "r", role: "broll", duration: 4 },
];

describe("planSpeechRanges", () => {
  it("widens each sound span by the margin, clamped to the clip, in whole milliseconds", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 0.1, 2.5), segment("s2", "a", 8, 9.9), segment("s3", "b", 1.2345, 3)), CLIPS, { margin: 0.25 });
    expect(ranges).toEqual([
      { clip: "a", startMs: 0, endMs: 2750 },
      { clip: "a", startMs: 7750, endMs: 10000 },
      { clip: "b", startMs: 984, endMs: 3250 },
    ]);
  });

  it("uses 0.25 s by default and no margin when asked", () => {
    expect(planSpeechRanges(edlOf(segment("s1", "a", 2, 3)), CLIPS)).toEqual([{ clip: "a", startMs: 1750, endMs: 3250 }]);
    expect(planSpeechRanges(edlOf(segment("s1", "a", 2, 3)), CLIPS, { margin: 0 })).toEqual([{ clip: "a", startMs: 2000, endMs: 3000 }]);
  });

  it("takes a borrowed sound span, and the picture clip's own span only when its sound stays under", () => {
    const borrowed = segment("r1", "r", 0, 2, { audio: { clip: "a", start: 4, end: 6, ownVolume: 0 } });
    const underneath = segment("s2", "b", 1, 2, { audio: { clip: "a", start: 7, end: 8, ownVolume: 0.3 } });
    expect(planSpeechRanges(edlOf(borrowed, underneath), CLIPS, { margin: 0 })).toEqual([
      { clip: "a", startMs: 4000, endMs: 6000 },
      { clip: "a", startMs: 7000, endMs: 8000 },
      { clip: "b", startMs: 1000, endMs: 2000 },
    ]);
  });

  it("isolates no b-roll, no unknown clip and no empty span", () => {
    expect(planSpeechRanges(edlOf(segment("r1", "r", 0, 2), segment("x", "missing", 0, 1), segment("s1", "a", 10, 10)), CLIPS, { margin: 0 })).toEqual([]);
  });

  it("keeps overlapping ranges apart, dropping only identical ranges and ranges inside another", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 1, 3), segment("s2", "a", 2.8, 5), segment("s3", "a", 1, 3), segment("s4", "a", 3.5, 4.5)), CLIPS, { margin: 0 });
    expect(ranges).toEqual([
      { clip: "a", startMs: 1000, endMs: 3000 },
      { clip: "a", startMs: 2800, endMs: 5000 },
    ]);
  });
});

describe("getSpeechRangeWindows", () => {
  const range = (startMs: number, endMs: number): SpeechRange => ({ clip: "a", startMs, endMs });

  it("lays a range alone whole", () => {
    expect(getSpeechRangeWindows([range(1000, 2000)])).toEqual([{ range: range(1000, 2000), startMs: 1000, endMs: 2000 }]);
  });

  it("switches overlapping neighbours at the middle of their overlap, leaving gaps as they are", () => {
    const windows = getSpeechRangeWindows([range(2800, 5000), range(1000, 3000), range(6000, 7000)]);
    expect(windows.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [1000, 2900],
      [2900, 5000],
      [6000, 7000],
    ]);
  });
});

describe("getSpeechRangeCache", () => {
  const options = { cacheDir: "/cache", provider: "elevenlabs" };

  it("keys a range by the clip, the range in milliseconds and the provider", () => {
    const one = getSpeechRangeCache("street", "clipkey", { clip: "a", startMs: 1000, endMs: 2000 }, options);
    expect(one.path).toBe(`/cache/street/${one.key}.isolated.mp3`);
    expect(one.key).toMatch(/^[0-9a-f]{16}$/);
    expect(getSpeechRangeCache("street", "clipkey", { clip: "other id", startMs: 1000, endMs: 2000 }, options).key).toBe(one.key);
    expect(getSpeechRangeCache("street", "clipkey", { clip: "a", startMs: 1000, endMs: 2001 }, options).key).not.toBe(one.key);
    expect(getSpeechRangeCache("street", "otherkey", { clip: "a", startMs: 1000, endMs: 2000 }, options).key).not.toBe(one.key);
    expect(getSpeechRangeCache("street", "clipkey", { clip: "a", startMs: 1000, endMs: 2000 }, { ...options, provider: "fake" }).key).not.toBe(one.key);
  });
});

describe("the range ffmpeg arguments", () => {
  it("cuts a range from the clip's sound by seeking", () => {
    expect(buildRangeAudioArgs("clip.mp4", { startMs: 1250, endMs: 3000 }, "out.mp3")).toEqual(["-v", "error", "-y", "-ss", "1.250", "-t", "1.750", "-i", "clip.mp4", "-vn", "-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });

  it("crossfades every join: windows trimmed to their fades, faded linearly, delayed in samples, the base under one minus their gains", () => {
    const first = { clip: "a", startMs: 1000, endMs: 3000 };
    const second = { clip: "a", startMs: 2800, endMs: 5000 };
    const args = buildRangeLayArgs(
      "clip.mp4",
      [
        { window: { range: first, startMs: 1000, endMs: 2900 }, file: "one.mp3", isMono: false },
        { window: { range: second, startMs: 2900, endMs: 5000 }, file: "two.mp3", isMono: true },
      ],
      "out.mp3",
    );
    expect(args.slice(0, 9)).toEqual(["-v", "error", "-y", "-i", "clip.mp4", "-i", "one.mp3", "-i", "two.mp3"]);
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph?.split(";")).toEqual([
      "[0:a]aformat=sample_rates=48000:channel_layouts=stereo,aeval='val(ch)*(1-(min(clip((t-1.000)/0.015,0,1),clip((2.907-t)/0.014,0,1))+min(clip((t-2.893)/0.014,0,1),clip((5.000-t)/0.015,0,1))))':c=same[base]",
      "[1:a]atrim=start=0.000:end=1.907,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:st=0:d=0.015,afade=t=out:st=1.893:d=0.014,adelay=48000S:all=1[w0]",
      "[2:a]atrim=start=0.093:end=2.200,asetpts=PTS-STARTPTS,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:st=0:d=0.014,afade=t=out:st=2.092:d=0.015,adelay=138864S:all=1[w1]",
      "[base][w0][w1]amix=inputs=3:duration=first:normalize=0[speech]",
    ]);
    expect(args.slice(-7)).toEqual(["-map", "[speech]", "-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });

  it("switches at once with fadeMs 0", () => {
    const range = { clip: "a", startMs: 1000, endMs: 2000 };
    const args = buildRangeLayArgs("clip.mp4", [{ window: { range, startMs: 1000, endMs: 2000 }, file: "one.mp3", isMono: false }], "out.mp3", { fadeMs: 0 });
    expect(args[args.indexOf("-filter_complex") + 1]?.split(";")).toEqual([
      "[0:a]aformat=sample_rates=48000:channel_layouts=stereo,aeval='val(ch)*(1-(min(gte(t,1.000),lt(t,2.000))))':c=same[base]",
      "[1:a]atrim=start=0.000:end=1.000,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,adelay=48000S:all=1[w0]",
      "[base][w0]amix=inputs=2:duration=first:normalize=0[speech]",
    ]);
  });

  it("copies the base's sound when no window is laid", () => {
    expect(buildRangeLayArgs("clip.mp4", [], "out.mp3")).toEqual(["-v", "error", "-y", "-i", "clip.mp4", "-vn", "-af", "aformat=sample_rates=48000:channel_layouts=stereo", "-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });
});

describe("getSpeechRangeFades", () => {
  const range = (startMs: number, endMs: number): SpeechRange => ({ clip: "a", startMs, endMs });

  it("fades inside a window at its range's own edges and shares one fade centred on a switch", () => {
    const windows = getSpeechRangeWindows([range(1000, 3000), range(2800, 5000), range(6000, 6010)]);
    expect(getSpeechRangeFades(windows, 20)).toEqual([
      { inStartMs: 1000, inEndMs: 1020, outStartMs: 2890, outEndMs: 2910 },
      { inStartMs: 2890, inEndMs: 2910, outStartMs: 4980, outEndMs: 5000 },
      { inStartMs: 6000, inEndMs: 6005, outStartMs: 6005, outEndMs: 6010 },
    ]);
  });

  it("keeps a switch's fade inside the overlap, and none at fade 0", () => {
    const windows = getSpeechRangeWindows([range(1000, 2004), range(2000, 3000)]);
    expect(getSpeechRangeFades(windows, 20).map(({ outStartMs, outEndMs }) => [outStartMs, outEndMs])).toEqual([
      [2000, 2004],
      [2980, 3000],
    ]);
    expect(getSpeechRangeFades(windows, 0)).toEqual([
      { inStartMs: 1000, inEndMs: 1000, outStartMs: 2002, outEndMs: 2002 },
      { inStartMs: 2002, inEndMs: 2002, outStartMs: 3000, outEndMs: 3000 },
    ]);
  });
});

describe.runIf(hasFfmpeg)("buildRangeLayArgs through ffmpeg (issue #1127)", () => {
  /** Runs the lay's filter graph on constant-level PCM inputs and answers the left channel's samples. */
  function layConstant(level: { base: number; windows: number }, laid: Parameters<typeof buildRangeLayArgs>[1], fadeMs?: number): Float32Array {
    const dir = mkdtempSync(join(tmpdir(), "footage-lay-"));
    try {
      const make = (name: string, value: number, seconds: number): string => {
        const file = join(dir, name);
        const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `aevalsrc=${String(value)}:s=48000:c=stereo:d=${String(seconds)}`, "-c:a", "pcm_f32le", file], { encoding: "utf8" });
        if (made.status !== 0) throw new Error(made.stderr);
        return file;
      };
      const base = make("base.wav", level.base, 3);
      const files = laid.map(({ window }, index) => make(`w${String(index)}.wav`, level.windows, (window.range.endMs - window.range.startMs) / 1000));
      const args = buildRangeLayArgs(base, laid.map((item, index) => ({ ...item, file: files[index] ?? "" })), "unused.mp3", fadeMs === undefined ? {} : { fadeMs });
      const output = join(dir, "out.raw");
      const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
      const inputs = args.slice(3, args.indexOf("-filter_complex"));
      const run = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[speech]", "-f", "f32le", "-c:a", "pcm_f32le", output], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(run.stderr);
      const bytes = readFileSync(output);
      const all = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      return all.filter((_, index) => index % 2 === 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const maxStep = (samples: Float32Array): number => samples.reduce((max, value, index) => (index === 0 ? max : Math.max(max, Math.abs(value - (samples[index - 1] ?? value)))), 0);
  const first = { clip: "a", startMs: 500, endMs: 1500 };
  const second = { clip: "a", startMs: 1300, endMs: 2500 };
  const laid = [
    { window: { range: first, startMs: 500, endMs: 1400 }, file: "", isMono: false },
    { window: { range: second, startMs: 1400, endMs: 2500 }, file: "", isMono: false },
  ];

  it("has no sample step above 0.01 at a join of a constant-level clip and a half-level window", () => {
    const samples = layConstant({ base: 0.8, windows: 0.4 }, laid);
    expect(samples.length).toBe(144000);
    expect(maxStep(samples)).toBeLessThan(0.01);
    expect(samples[24000 - 1000]).toBeCloseTo(0.8, 4);
    expect(samples[48000]).toBeCloseTo(0.4, 4);
    expect(samples[67200]).toBeCloseTo(0.4, 4);
    expect(samples[140000]).toBeCloseTo(0.8, 4);
  });

  it("steps at once without a fade", () => {
    expect(maxStep(layConstant({ base: 0.8, windows: 0.4 }, laid, 0))).toBeGreaterThan(0.3);
  });
});
