import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Edl } from "./edl.js";
import {
  buildCoverArgs,
  buildFinishArgs,
  clampCoverSeconds,
  findFinishProblems,
  getCoverPath,
  getDefaultCoverSeconds,
  isFastStart,
  readFilmFacts,
  readTopLevelBoxes,
  type FilmFacts,
} from "./publish.js";

const PROBE = {
  streams: [
    { codec_type: "video", codec_name: "h264", profile: "High", pix_fmt: "yuv420p", width: 1080, height: 1920 },
    { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2 },
  ],
  format: { duration: "14.533333", size: "5242880" },
};

const PUBLISHABLE: FilmFacts = {
  bytes: 5242880,
  width: 1080,
  height: 1920,
  durationSeconds: 14.533333,
  video: { codec: "h264", profile: "High", pixelFormat: "yuv420p" },
  audio: { codec: "aac", sampleRate: 48000, channels: 2 },
};

describe("readFilmFacts", () => {
  it("reads the picture, the sound, the length and the size", () => {
    expect(readFilmFacts(PROBE)).toEqual({ ok: true, facts: PUBLISHABLE });
  });

  it("reads a film without sound", () => {
    const read = readFilmFacts({ ...PROBE, streams: [PROBE.streams[0]] });
    expect(read.ok && read.facts.audio).toBeNull();
  });

  it("names what is missing", () => {
    expect(readFilmFacts({ streams: [PROBE.streams[1]], format: PROBE.format })).toEqual({ ok: false, error: "no video stream" });
    expect(readFilmFacts({ streams: PROBE.streams, format: {} })).toEqual({ ok: false, error: "no duration" });
    expect(readFilmFacts("nope")).toEqual({ ok: false, error: "ffprobe printed an unexpected shape" });
  });
});

describe("buildFinishArgs", () => {
  it("copies streams that are already publishable and moves the moov box to the front", () => {
    expect(buildFinishArgs("/b/render.mp4", PUBLISHABLE, "/out/film.mp4")).toEqual([
      "-v",
      "error",
      "-y",
      "-i",
      "/b/render.mp4",
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      "-map",
      "0:a:0",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "/out/film.mp4",
    ]);
  });

  it("re-encodes a picture outside H.264 High yuv420p and sound outside AAC 48 kHz stereo", () => {
    const args = buildFinishArgs("/r.mp4", { video: { codec: "h264", profile: "Main", pixelFormat: "yuv420p" }, audio: { codec: "aac", sampleRate: 44100, channels: 2 } }, "/f.mp4").join(" ");
    expect(args).toContain("-c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium -crf 18");
    expect(args).toContain("-map 0:a:0 -c:a aac -b:a 192k -ar 48000 -ac 2");
  });

  it("adds no sound to a film without any", () => {
    expect(buildFinishArgs("/r.mp4", { video: PUBLISHABLE.video, audio: null }, "/f.mp4")).not.toContain("0:a:0");
  });
});

describe("readTopLevelBoxes and isFastStart", () => {
  const box = (type: string, payload: number): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload, 0);
    header.write(type, 4, "latin1");
    return Buffer.concat([header, Buffer.alloc(payload)]);
  };

  it("reads the boxes in file order", () => {
    const dir = mkdtempSync(join(tmpdir(), "marketing-kit-boxes-"));
    try {
      const fast = join(dir, "fast.mp4");
      const slow = join(dir, "slow.mp4");
      writeFileSync(fast, Buffer.concat([box("ftyp", 16), box("moov", 40), box("mdat", 100)]));
      writeFileSync(slow, Buffer.concat([box("ftyp", 16), box("mdat", 100), box("moov", 40)]));
      expect(readTopLevelBoxes(fast)).toEqual(["ftyp", "moov", "mdat"]);
      expect(isFastStart(readTopLevelBoxes(fast))).toBe(true);
      expect(isFastStart(readTopLevelBoxes(slow))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a file that is not an MP4", () => {
    const dir = mkdtempSync(join(tmpdir(), "marketing-kit-boxes-"));
    try {
      const file = join(dir, "text.mp4");
      writeFileSync(file, Buffer.from([0, 0, 0, 3, 0x61, 0x62, 0x63, 0x64]));
      expect(() => readTopLevelBoxes(file)).toThrow("a box of 3 bytes at 0 is not an MP4 box");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("has no fast start without a moov box", () => {
    expect(isFastStart(["ftyp", "mdat"])).toBe(false);
  });
});

describe("findFinishProblems", () => {
  it("passes a publishable film", () => {
    expect(findFinishProblems(PUBLISHABLE, ["ftyp", "moov", "mdat"])).toEqual([]);
  });

  it("names every problem", () => {
    const facts: FilmFacts = { ...PUBLISHABLE, video: { codec: "hevc", profile: "Main 10", pixelFormat: "yuv420p10le" }, audio: { codec: "mp3", sampleRate: 44100, channels: 1 } };
    expect(findFinishProblems(facts, ["ftyp", "mdat", "moov"])).toEqual([
      "the picture is hevc Main 10 yuv420p10le, not h264 High yuv420p",
      "the sound is mp3 44100 Hz 1 channels, not aac 48000 Hz stereo",
      "the moov box is not before the media (no fast start)",
    ]);
  });
});

describe("the cover", () => {
  const edl: Edl = {
    version: 2,
    film: "film",
    segments: [
      { id: "g1", clip: "street", start: 0, end: 3, transition: "cut", motion: "kenburns" },
      { id: "g2", clip: "talk", start: 1, end: 5, transition: "fade", motion: "none" },
    ],
  };

  it("is taken by default in the middle of the first talking segment", () => {
    expect(getDefaultCoverSeconds(edl, { street: "broll", talk: "talk" })).toBe(5);
  });

  it("falls back to the first segment when nobody talks", () => {
    expect(getDefaultCoverSeconds(edl, { street: "broll", talk: "broll" })).toBe(1.5);
  });

  it("stays inside the film", () => {
    expect(clampCoverSeconds(30, 14.5)).toBe(14.4);
    expect(clampCoverSeconds(-1, 14.5)).toBe(0);
    expect(clampCoverSeconds(3, 14.5)).toBe(3);
  });

  it("is one JPG frame next to the film", () => {
    expect(getCoverPath("/out/film/film.placeholder.mp4")).toBe("/out/film/film.placeholder.jpg");
    expect(buildCoverArgs("/out/f.mp4", 2.5, "/out/f.jpg")).toEqual(["-v", "error", "-y", "-ss", "2.5", "-i", "/out/f.mp4", "-frames:v", "1", "-q:v", "2", "/out/f.jpg"]);
  });
});
