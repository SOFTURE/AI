import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Edl } from "./edl.js";
import type { X264Preset } from "./normalize.js";
import {
  buildCoverArgs,
  buildFinishArgs,
  clampCoverSeconds,
  findFinishProblems,
  findFinishVideoProblems,
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

  it.each(["Constrained Baseline", "Main", "High"])("copies an H.264 %s yuv420p picture (issue #1051)", (profile) => {
    const args = buildFinishArgs("/r.mp4", { ...PUBLISHABLE, video: { codec: "h264", profile, pixelFormat: "yuv420p" } }, "/f.mp4").join(" ");
    expect(args).toContain("-c:v copy");
    expect(args).not.toContain("libx264");
  });

  it.each([
    { codec: "h264", profile: "Baseline", pixelFormat: "yuv420p" },
    { codec: "h264", profile: "High 10", pixelFormat: "yuv420p10le" },
    { codec: "h264", profile: "High 4:2:2", pixelFormat: "yuv422p" },
    { codec: "h264", profile: null, pixelFormat: "yuv420p" },
    { codec: "hevc", profile: "Main", pixelFormat: "yuv420p" },
  ])("re-encodes an $codec $profile $pixelFormat picture to H.264 High", (video) => {
    expect(buildFinishArgs("/r.mp4", { ...PUBLISHABLE, video }, "/f.mp4").join(" ")).toContain("-c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium -crf 18");
  });

  it("re-encodes a picture outside H.264 yuv420p and sound outside AAC 48 kHz stereo", () => {
    const args = buildFinishArgs("/r.mp4", { video: { codec: "h264", profile: "High", pixelFormat: "yuv444p" }, audio: { codec: "aac", sampleRate: 44100, channels: 2 } }, "/f.mp4").join(" ");
    expect(args).toContain("-c:v libx264 -profile:v high -pix_fmt yuv420p -preset medium -crf 18");
    expect(args).toContain("-map 0:a:0 -c:a aac -b:a 192k -ar 48000 -ac 2");
  });

  it("re-encodes publishable sound through the mix's loudness filter and still copies the picture (issue #1031)", () => {
    const args = buildFinishArgs("/r.mp4", PUBLISHABLE, "/f.mp4", { audioFilter: "loudnorm=I=-14" }).join(" ");
    expect(args).toContain("-c:v copy -map 0:a:0 -af loudnorm=I=-14 -c:a aac -b:a 192k -ar 48000 -ac 2");
  });

  it("ignores the loudness filter on a film without sound", () => {
    expect(buildFinishArgs("/r.mp4", { video: PUBLISHABLE.video, audio: null }, "/f.mp4", { audioFilter: "loudnorm=I=-14" })).not.toContain("-af");
  });

  it("re-encodes even a publishable picture to H.264 High at the asked preset and CRF (issue #1068)", () => {
    expect(buildFinishArgs("/r.mp4", PUBLISHABLE, "/f.mp4", { video: { preset: "veryfast", crf: 20 } })).toEqual([
      "-v",
      "error",
      "-y",
      "-i",
      "/r.mp4",
      "-map",
      "0:v:0",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-map",
      "0:a:0",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "/f.mp4",
    ]);
  });

  it.each([
    { maxBitrate: "12M", bufsize: "24M" },
    { maxBitrate: "12000k", bufsize: "24000k" },
    { maxBitrate: "12.5M", bufsize: "25M" },
    { maxBitrate: "8000000", bufsize: "16000000" },
  ])("caps the re-encode at $maxBitrate with a $bufsize buffer", ({ maxBitrate, bufsize }) => {
    const args = buildFinishArgs("/r.mp4", PUBLISHABLE, "/f.mp4", { video: { preset: "veryfast", crf: 20, maxBitrate } }).join(" ");
    expect(args).toContain(`-preset veryfast -crf 20 -maxrate ${maxBitrate} -bufsize ${bufsize} -map 0:a:0`);
  });

  it("keeps the loudness pass beside the asked picture encode", () => {
    const args = buildFinishArgs("/r.mp4", PUBLISHABLE, "/f.mp4", { audioFilter: "loudnorm=I=-14", video: { preset: "faster", crf: 22 } }).join(" ");
    expect(args).toContain("-c:v libx264 -profile:v high -pix_fmt yuv420p -preset faster -crf 22 -map 0:a:0 -af loudnorm=I=-14 -c:a aac");
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

  it("passes a copied draft film in H.264 Constrained Baseline (issue #1051)", () => {
    const facts: FilmFacts = { ...PUBLISHABLE, video: { codec: "h264", profile: "Constrained Baseline", pixelFormat: "yuv420p" } };
    expect(findFinishProblems(facts, ["ftyp", "moov", "mdat"])).toEqual([]);
  });

  it("names every problem", () => {
    const facts: FilmFacts = { ...PUBLISHABLE, video: { codec: "hevc", profile: "Main 10", pixelFormat: "yuv420p10le" }, audio: { codec: "mp3", sampleRate: 44100, channels: 1 } };
    expect(findFinishProblems(facts, ["ftyp", "mdat", "moov"])).toEqual([
      "the picture is hevc Main 10 yuv420p10le, not h264 (Constrained Baseline, Main or High) yuv420p",
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

describe("findFinishVideoProblems (issue #1068)", () => {
  it("accepts a preset, a CRF and an optional cap", () => {
    expect(findFinishVideoProblems({ preset: "veryfast", crf: 20 })).toEqual([]);
    expect(findFinishVideoProblems({ preset: "ultrafast", crf: 0, maxBitrate: "12M" })).toEqual([]);
    expect(findFinishVideoProblems({ preset: "veryslow", crf: 51, maxBitrate: "12000k" })).toEqual([]);
  });

  it("names an unknown preset", () => {
    expect(findFinishVideoProblems({ preset: "turbo" as X264Preset, crf: 20 })).toEqual([
      "finishVideo.preset must be one of ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow, got turbo.",
    ]);
  });

  it.each([-1, 52, 20.5, Number.NaN])("names a CRF of %s", (crf) => {
    expect(findFinishVideoProblems({ preset: "veryfast", crf })).toEqual([`finishVideo.crf must be a whole number from 0 to 51, got ${String(crf)}.`]);
  });

  it.each(["", "12 M", "12G", "0M", "-3M", "fast"])("names a cap of %j", (maxBitrate) => {
    expect(findFinishVideoProblems({ preset: "veryfast", crf: 20, maxBitrate })).toEqual([`finishVideo.maxBitrate must be a positive rate such as "12M" or "12000k", got "${maxBitrate}".`]);
  });
});
