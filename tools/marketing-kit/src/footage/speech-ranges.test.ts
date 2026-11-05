import { describe, expect, it } from "vitest";

import type { Edl, EdlSegment } from "./edl.js";
import { buildRangeAudioArgs, buildRangeLayArgs, getSpeechRangeCache, getSpeechRangeWindows, planSpeechRanges, type SpeechRange, type SpeechRangeClip } from "./speech-ranges.js";

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

  it("mutes every window in the base and delays each cleaned window into place, panning a mono answer", () => {
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
      "[0:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0:enable='between(t,1.000,2.900)+between(t,2.900,5.000)'[base]",
      "[1:a]atrim=start=0.000:end=1.900,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,adelay=1000:all=1[w0]",
      "[2:a]atrim=start=0.100:end=2.200,asetpts=PTS-STARTPTS,pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000:channel_layouts=stereo,adelay=2900:all=1[w1]",
      "[base][w0][w1]amix=inputs=3:duration=first:normalize=0[speech]",
    ]);
    expect(args.slice(-7)).toEqual(["-map", "[speech]", "-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });

  it("copies the base's sound when no window is laid", () => {
    expect(buildRangeLayArgs("clip.mp4", [], "out.mp3")).toEqual(["-v", "error", "-y", "-i", "clip.mp4", "-vn", "-af", "aformat=sample_rates=48000:channel_layouts=stereo", "-c:a", "libmp3lame", "-q:a", "2", "out.mp3"]);
  });
});
