import { describe, expect, it } from "vitest";

import type { FootageClip } from "./film.js";
import { describeProbe, findFootageProblems, getTrimmedDuration, normalizeRotation, readFootageProbe, type FootageProbe } from "./probe.js";

function ffprobe(video: Record<string, unknown>, options: { audio?: boolean; duration?: string } = {}) {
  const streams: Record<string, unknown>[] = [{ codec_type: "video", codec_name: "h264", width: 1920, height: 1080, pix_fmt: "yuv420p", ...video }];
  if (options.audio !== false) streams.push({ codec_type: "audio", codec_name: "aac" });
  return { streams, format: { duration: options.duration ?? "12.5" } };
}

function probeOf(json: unknown): FootageProbe {
  const result = readFootageProbe(json);
  if (!result.ok) throw new Error(result.error);
  return result.probe;
}

const clip = (trim: FootageClip["trim"]): FootageClip => ({ id: "talk", source: "/clips/talk.mov", role: "talk", fit: "auto", trim, script: null });

describe("readFootageProbe", () => {
  it("reads a plain landscape clip with sound", () => {
    expect(probeOf(ffprobe({}))).toEqual({
      duration: 12.5,
      width: 1920,
      height: 1080,
      rotation: 0,
      displayWidth: 1920,
      displayHeight: 1080,
      codec: "h264",
      pixelFormat: "yuv420p",
      colorTransfer: null,
      hdr: null,
      hasAudio: true,
    });
  });

  it("turns a phone's portrait clip by its display matrix and swaps the shown size", () => {
    const probe = probeOf(ffprobe({ side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }] }));
    expect([probe.rotation, probe.displayWidth, probe.displayHeight]).toEqual([270, 1080, 1920]);
  });

  it("reads the clockwise rotate tag of older muxers", () => {
    const probe = probeOf(ffprobe({ tags: { rotate: "90" } }));
    expect([probe.rotation, probe.displayWidth, probe.displayHeight]).toEqual([270, 1080, 1920]);
  });

  it("keeps a 180 degree turn at the stored size", () => {
    const probe = probeOf(ffprobe({ side_data_list: [{ side_data_type: "Display Matrix", rotation: 180 }] }));
    expect([probe.rotation, probe.displayWidth, probe.displayHeight]).toEqual([180, 1920, 1080]);
  });

  it.each([
    [{ color_transfer: "smpte2084" }, "pq"],
    [{ color_transfer: "arib-std-b67" }, "hlg"],
    [{ color_transfer: "arib-std-b67", side_data_list: [{ side_data_type: "DOVI configuration record" }] }, "dolby-vision"],
    [{ color_transfer: "bt709" }, null],
  ])("detects HDR from %j as %s", (video, hdr) => {
    expect(probeOf(ffprobe({ codec_name: "hevc", ...video })).hdr).toBe(hdr);
  });

  it("notes a clip without sound", () => {
    expect(probeOf(ffprobe({}, { audio: false })).hasAudio).toBe(false);
  });

  it.each([
    [{ streams: [{ codec_type: "audio" }], format: { duration: "3" } }, "no video stream"],
    [ffprobe({}, { duration: "N/A" }), "no duration"],
    ["not an object", "ffprobe printed an unexpected shape"],
  ])("refuses %j: %s", (json, error) => {
    expect(readFootageProbe(json)).toEqual({ ok: false, error });
  });
});

describe("normalizeRotation", () => {
  it.each([
    [0, 0],
    [-90, 270],
    [90, 90],
    [-180, 180],
    [450, 90],
    [-270, 90],
  ])("turns %d into %d", (input, output) => {
    expect(normalizeRotation(input)).toBe(output);
  });
});

describe("findFootageProblems", () => {
  const probe = probeOf(ffprobe({}, { duration: "10" }));

  it("finds nothing in a clip trimmed inside its length", () => {
    expect(findFootageProblems(clip({ start: 1, end: 8 }), probe)).toEqual([]);
    expect(getTrimmedDuration(clip({ start: 1, end: 8 }), probe)).toBe(7);
    expect(getTrimmedDuration(clip({ start: 2, end: null }), probe)).toBe(8);
  });

  it("reports a start past the end, an end before the start and too little left", () => {
    expect(findFootageProblems(clip({ start: 12, end: null }), probe)).toEqual(["trim.start 12 s is past the clip's end (10.00 s)"]);
    expect(findFootageProblems(clip({ start: 5, end: 4 }), probe)).toEqual(["trim.end 4 s is not after trim.start 5 s"]);
    expect(findFootageProblems(clip({ start: 9.8, end: null }), probe)).toEqual(["shorter than 0.3 s after the trim"]);
  });

  it("describes a turned HDR clip for the log", () => {
    const hdr = probeOf(ffprobe({ codec_name: "hevc", color_transfer: "arib-std-b67", side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }] }, { audio: false }));
    expect(describeProbe(clip({ start: 0, end: null }), hdr)).toBe("clip talk (talk): 1080×1920, hevc, 12.5 s, rotated 270°, HDR (hlg), tone-mapped to SDR, no sound");
  });
});
