import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Edl, EdlSegment } from "./edl.js";
import {
  buildRangeAudioArgs,
  buildRangeLayArgs,
  buildRangeMeasureArgs,
  formatSpeechRangeGain,
  getRangeInputGainDb,
  getSpeechRangeCache,
  getSpeechRangeGainPath,
  getSpeechRangeFades,
  getSpeechRangeWindows,
  planSpeechRanges,
  readSpeechRangeGain,
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
    expect(planSpeechRanges(edlOf(borrowed, underneath), CLIPS, { margin: 0, mergeGap: null })).toEqual([
      { clip: "a", startMs: 4000, endMs: 6000 },
      { clip: "a", startMs: 7000, endMs: 8000 },
      { clip: "b", startMs: 1000, endMs: 2000 },
    ]);
  });

  it("isolates no b-roll, no unknown clip and no empty span", () => {
    expect(planSpeechRanges(edlOf(segment("r1", "r", 0, 2), segment("x", "missing", 0, 1), segment("s1", "a", 10, 10)), CLIPS, { margin: 0 })).toEqual([]);
  });

  it("with mergeGap null keeps overlapping ranges apart, dropping only identical ranges and ranges inside another", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 1, 3), segment("s2", "a", 2.8, 5), segment("s3", "a", 1, 3), segment("s4", "a", 3.5, 4.5)), CLIPS, { margin: 0, mergeGap: null });
    expect(ranges).toEqual([
      { clip: "a", startMs: 1000, endMs: 3000 },
      { clip: "a", startMs: 2800, endMs: 5000 },
    ]);
  });
});

describe("planSpeechRanges to the provider's minimum (issue #1140)", () => {
  it("merges ranges of a clip at most 2 s apart by default, keeping farther ones apart", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 1, 2), segment("s2", "a", 3.5, 4), segment("s3", "a", 7, 8), segment("s4", "b", 1, 2)), CLIPS, { margin: 0 });
    expect(ranges).toEqual([
      { clip: "a", startMs: 1000, endMs: 4000 },
      { clip: "a", startMs: 7000, endMs: 8000 },
      { clip: "b", startMs: 1000, endMs: 2000 },
    ]);
    expect(planSpeechRanges(edlOf(segment("s1", "a", 1, 2), segment("s3", "a", 7, 8)), CLIPS, { margin: 0, mergeGap: Infinity })).toEqual([{ clip: "a", startMs: 1000, endMs: 8000 }]);
  });

  it("widens a range shorter than the minimum symmetrically to the minimum plus the pad, shifted at the clip's edges", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 0.2, 1), segment("s2", "a", 4, 5), segment("s3", "a", 9, 9.8)), CLIPS, { margin: 0, mergeGap: null, minSeconds: 4.6 });
    expect(ranges).toEqual([
      { clip: "a", startMs: 0, endMs: 5000, heard: { startMs: 200, endMs: 1000 } },
      { clip: "a", startMs: 2000, endMs: 7000, heard: { startMs: 4000, endMs: 5000 } },
      { clip: "a", startMs: 5000, endMs: 10000, heard: { startMs: 9000, endMs: 9800 } },
    ]);
    expect(planSpeechRanges(edlOf(segment("s1", "a", 4, 5)), CLIPS, { margin: 0, minSeconds: 4.6, minPad: 0 })).toEqual([{ clip: "a", startMs: 2200, endMs: 6800, heard: { startMs: 4000, endMs: 5000 } }]);
    expect(planSpeechRanges(edlOf(segment("s1", "a", 1, 6)), CLIPS, { margin: 0, minSeconds: 4.6 })).toEqual([{ clip: "a", startMs: 1000, endMs: 6000 }]);
  });

  it("merges ranges the widening brought within the gap, joining what the cut hears", () => {
    const ranges = planSpeechRanges(edlOf(segment("s1", "a", 1, 1.5), segment("s2", "a", 5, 5.5)), CLIPS, { margin: 0, minSeconds: 4.6 });
    expect(ranges).toEqual([{ clip: "a", startMs: 0, endMs: 7750, heard: { startMs: 1000, endMs: 5500 } }]);
  });

  it("marks a range still shorter than the minimum, its clip being shorter, as skipped", () => {
    const clips: SpeechRangeClip[] = [{ id: "c", role: "talk", duration: 3 }];
    expect(planSpeechRanges(edlOf(segment("s1", "c", 0.5, 2)), clips, { margin: 0, minSeconds: 4.6 })).toEqual([
      { clip: "c", startMs: 0, endMs: 3000, heard: { startMs: 500, endMs: 2000 }, skip: { reason: "too_short", minSeconds: 4.6 } },
    ]);
  });
});

describe("getSpeechRangeWindows", () => {
  const range = (startMs: number, endMs: number): SpeechRange => ({ clip: "a", startMs, endMs });

  it("lays a range alone whole", () => {
    expect(getSpeechRangeWindows([range(1000, 2000)])).toEqual([{ range: range(1000, 2000), startMs: 1000, endMs: 2000 }]);
  });

  it("lays only the part of a widened range the cut hears", () => {
    const widened: SpeechRange = { clip: "a", startMs: 0, endMs: 5000, heard: { startMs: 1000, endMs: 1500 } };
    expect(getSpeechRangeWindows([widened, range(6000, 7000)])).toEqual([
      { range: widened, startMs: 1000, endMs: 1500 },
      { range: range(6000, 7000), startMs: 6000, endMs: 7000 },
    ]);
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

  it("raises a window by its gainDb before its fades, and leaves a 0 dB window as it is (issue #1159)", () => {
    const range = { clip: "a", startMs: 1000, endMs: 2000 };
    const other = { clip: "a", startMs: 3000, endMs: 4000 };
    const args = buildRangeLayArgs(
      "clip.wav",
      [
        { window: { range, startMs: 1000, endMs: 2000 }, file: "one.mp3", isMono: false, gainDb: 17.25 },
        { window: { range: other, startMs: 3000, endMs: 4000 }, file: "two.mp3", isMono: false, gainDb: 0 },
      ],
      "out.wav",
      { fadeMs: 0 },
    );
    expect(args[args.indexOf("-filter_complex") + 1]?.split(";").slice(1, 3)).toEqual([
      "[1:a]atrim=start=0.000:end=1.000,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=17.25dB,adelay=48000S:all=1[w0]",
      "[2:a]atrim=start=0.000:end=1.000,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,adelay=144000S:all=1[w1]",
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

describe("the input gain of a cached range (issue #1159)", () => {
  it("records the gain next to the cached file and reads it back", () => {
    expect(getSpeechRangeGainPath("/cache/street/abc.isolated.mp3")).toBe("/cache/street/abc.isolated.mp3.gain.json");
    expect(formatSpeechRangeGain(17.3)).toBe('{"inputGainDb":17.3}\n');
    expect(readSpeechRangeGain(formatSpeechRangeGain(-2.5))).toBe(-2.5);
    expect(readSpeechRangeGain(formatSpeechRangeGain(0))).toBe(0);
  });

  it("reads a broken or foreign record as none", () => {
    expect(readSpeechRangeGain("not json")).toBeNull();
    expect(readSpeechRangeGain("null")).toBeNull();
    expect(readSpeechRangeGain('{"inputGainDb":"17"}')).toBeNull();
    expect(readSpeechRangeGain("{}")).toBeNull();
  });

  it("tells a range cut from the un-gained sound by a level near the clip's gain under the base", () => {
    expect(getRangeInputGainDb({ clipGainDb: 17, cleanedLufs: -41.5, baseLufs: -23 })).toBe(0);
    expect(getRangeInputGainDb({ clipGainDb: 17, cleanedLufs: -25, baseLufs: -23 })).toBe(17);
    expect(getRangeInputGainDb({ clipGainDb: 17, cleanedLufs: -21, baseLufs: -23 })).toBe(17);
  });

  it("follows a negative gain the same way", () => {
    expect(getRangeInputGainDb({ clipGainDb: -6, cleanedLufs: -16.5, baseLufs: -23 })).toBe(0);
    expect(getRangeInputGainDb({ clipGainDb: -6, cleanedLufs: -23.5, baseLufs: -23 })).toBe(-6);
  });

  it("keeps the clip's gain when either side is silent or the clip has no gain", () => {
    expect(getRangeInputGainDb({ clipGainDb: 17, cleanedLufs: null, baseLufs: -23 })).toBe(17);
    expect(getRangeInputGainDb({ clipGainDb: 17, cleanedLufs: -40, baseLufs: null })).toBe(17);
    expect(getRangeInputGainDb({ clipGainDb: 0, cleanedLufs: -40, baseLufs: -23 })).toBe(0);
  });

  it("measures a whole file or only a range of it", () => {
    const measure = "aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-23:TP=-2:LRA=11:print_format=json";
    expect(buildRangeMeasureArgs("one.mp3")).toEqual(["-hide_banner", "-nostats", "-i", "one.mp3", "-map", "0:a:0", "-vn", "-af", measure, "-f", "null", "-"]);
    expect(buildRangeMeasureArgs("clip.wav", { startMs: 800, endMs: 2200 })).toEqual(["-hide_banner", "-nostats", "-ss", "0.800", "-t", "1.400", "-i", "clip.wav", "-map", "0:a:0", "-vn", "-af", measure, "-f", "null", "-"]);
  });
});
