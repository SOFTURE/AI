import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CUT_THUMBNAIL, buildCutFrameArgs, chooseCutTransition, chooseCutTransitions, findAutoCuts, measureFrameDifference } from "./cuts.js";
import { buildEdl, type Edl } from "./edl.js";
import type { FootageFilm } from "./film.js";
import { CUTS_FILE, cutFootageFilm, describeCutMeasures, type PreparedClip } from "./pipeline.js";
import type { FootageProbe } from "./probe.js";

const SIZE = CUT_THUMBNAIL.width * CUT_THUMBNAIL.height;

/** A gray frame: a horizontal gradient shifted by `shift` pixels, plus a little noise from `seed`, like handheld shake. */
function makeFrame(shift: number, seed: number): Uint8Array {
  const frame = new Uint8Array(SIZE);
  for (let y = 0; y < CUT_THUMBNAIL.height; y++) {
    for (let x = 0; x < CUT_THUMBNAIL.width; x++) {
      const noise = ((x * 31 + y * 17 + seed * 7) % 5) - 2;
      frame[y * CUT_THUMBNAIL.width + x] = Math.max(0, Math.min(255, ((x + shift) % CUT_THUMBNAIL.width) * 5 + noise));
    }
  }
  return frame;
}

describe("measureFrameDifference and chooseCutTransition", () => {
  it("gives two frames of one shot a small difference and a zoom", () => {
    const difference = measureFrameDifference(makeFrame(0, 1), makeFrame(1, 2));
    expect(difference).toBeGreaterThan(0);
    expect(difference).toBeLessThan(0.08);
    expect(chooseCutTransition(difference)).toBe("zoom");
  });

  it("gives frames after a camera move a large difference and a fade", () => {
    const difference = measureFrameDifference(makeFrame(0, 1), makeFrame(20, 2));
    expect(difference).toBeGreaterThanOrEqual(0.08);
    expect(chooseCutTransition(difference)).toBe("fade");
  });

  it("measures 0 for the same frame and 1 for black against white, and follows the threshold", () => {
    expect(measureFrameDifference(new Uint8Array(4).fill(9), new Uint8Array(4).fill(9))).toBe(0);
    expect(measureFrameDifference(new Uint8Array(4), new Uint8Array(4).fill(255))).toBe(1);
    expect(chooseCutTransition(0.05, 0.05)).toBe("fade");
    expect(chooseCutTransition(0.05, 0.2)).toBe("zoom");
  });

  it("refuses frames of different sizes or none", () => {
    expect(() => measureFrameDifference(new Uint8Array(4), new Uint8Array(5))).toThrow("Comparing the frames around a cut needs two frames of one size, got 4 and 5 bytes.");
    expect(() => measureFrameDifference(new Uint8Array(0), new Uint8Array(0))).toThrow("got 0 and 0 bytes");
  });
});

describe("findAutoCuts and buildCutFrameArgs", () => {
  it("picks the plain cuts inside one clip, never the first segment, a cut between clips or a set transition", () => {
    const edl: Edl = {
      version: 2,
      film: "f",
      segments: [
        { id: "s1", clip: "talk", start: 0, end: 1, transition: "cut", motion: "none" },
        { id: "s2", clip: "talk", start: 1.5, end: 2, transition: "cut", motion: "none" },
        { id: "s3", clip: "talk", start: 2.5, end: 3, transition: "whoosh", motion: "none" },
        { id: "r1", clip: "street", start: 0, end: 1, transition: "cut", motion: "none" },
        { id: "s4", clip: "talk", start: 3.5, end: 4, transition: "cut", motion: "none" },
        { id: "s5", clip: "talk", start: 4.5, end: 5, transition: "cut", motion: "none" },
      ],
    };
    expect(findAutoCuts(edl)).toEqual([1, 5]);
  });

  it("reads one frame as a small raw gray thumbnail", () => {
    expect(buildCutFrameArgs("/clips/talk.mp4", 1.38, "/tmp/s2-after.gray")).toEqual([
      "-v",
      "error",
      "-y",
      "-ss",
      "1.38",
      "-i",
      "/clips/talk.mp4",
      "-frames:v",
      "1",
      "-vf",
      "scale=48:48:flags=area,format=gray",
      "-f",
      "rawvideo",
      "/tmp/s2-after.gray",
    ]);
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("the auto choice with ffmpeg", () => {
  let dir = "";

  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  /** A talking clip that holds one shot for 2 s, then shows another (the camera moved). */
  function makeClip(): string {
    const file = join(dir, "talk.mp4");
    const made = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "smptebars=s=360x640:r=30:d=2",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=360x640:r=30:d=2",
      "-filter_complex",
      "[0:v][1:v]concat=n=2:v=1:a=0[v]",
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-g",
      "15",
      "-pix_fmt",
      "yuv420p",
      file,
    ]);
    if (made.status !== 0) throw new Error(`making the test clip failed: ${made.stderr.toString()}`);
    return file;
  }

  const film: FootageFilm = {
    id: "street",
    title: "Street",
    format: "9:16",
    language: "pl",
    clips: [],
    isolateVoice: false,
    cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.12, maxSeconds: null },
    transitions: { jump: "auto", clip: "cut" },
    music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
    captions: false,
    endCard: null,
  };
  // Two pauses: a cut inside the first shot, and one across the camera's move at 2 s.
  const words = {
    talk: [
      { text: "Hej", start: 0.2, end: 0.7 },
      { text: "tam", start: 1.5, end: 1.8 },
      { text: "znowu", start: 2.6, end: 3 },
    ],
  };

  it("zooms the cut inside one shot and fades the cut where the picture changed, and writes what it measured", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-cuts-"));
    const file = makeClip();
    const clip: PreparedClip = { clip: { id: "talk", source: file, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe: {} as FootageProbe, file, duration: 4 };
    const edlPath = join(dir, "build", "edl.json");
    const { edl, cuts } = await cutFootageFilm(film, [clip], words, edlPath);
    expect(edl.segments.map((segment) => segment.transition)).toEqual(["cut", "zoom", "fade"]);
    expect(cuts.map((cut) => [cut.segment, cut.transition])).toEqual([
      ["s1.2", "zoom"],
      ["s1.3", "fade"],
    ]);
    expect(cuts[0]?.difference).toBeLessThan(0.08);
    expect(cuts[1]?.difference).toBeGreaterThanOrEqual(0.08);
    expect(describeCutMeasures(cuts)[0]).toMatch(/^s1\.2: zoom \(difference 0\.\d{3}\)$/);
    expect(JSON.parse(readFileSync(edlPath, "utf8"))).toEqual(edl);
    expect(JSON.parse(readFileSync(join(dir, "build", CUTS_FILE), "utf8"))).toEqual({ threshold: 0.08, cuts });
    // The thumbnails are gone once measured.
    expect(existsSync(join(dir, "build", "cut-frames"))).toBe(false);
    // A threshold above every difference zooms both; a film without auto measures nothing and writes no cuts file.
    const calm = await cutFootageFilm({ ...film, transitions: { jump: "auto", clip: "cut", autoThreshold: 1 } }, [clip], words, edlPath);
    expect(calm.edl.segments.map((segment) => segment.transition)).toEqual(["cut", "zoom", "zoom"]);
    const plain = await cutFootageFilm({ ...film, transitions: { jump: "cut", clip: "cut" } }, [clip], words, edlPath);
    expect(plain.cuts).toEqual([]);
    expect(plain.edl.segments.map((segment) => segment.transition)).toEqual(["cut", "cut", "cut"]);
    expect(existsSync(join(dir, "build", CUTS_FILE))).toBe(false);
  }, 60_000);

  it("leaves set transitions as they are and refuses a threshold outside 0-1", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-cuts-"));
    const file = makeClip();
    const built = buildEdl("street", [{ id: "talk", role: "talk", duration: 4, words: words.talk }], film.cut, film.transitions);
    expect(built.segments.map((segment) => segment.transition)).toEqual(["cut", "cut", "cut"]);
    const handEdited: Edl = { ...built, segments: built.segments.map((segment, index) => (index === 2 ? { ...segment, transition: "whoosh" } : segment)) };
    const chosen = await chooseCutTransitions(handEdited, { talk: file }, { workDir: join(dir, "frames") });
    expect(chosen.edl.segments.map((segment) => segment.transition)).toEqual(["cut", "zoom", "whoosh"]);
    await expect(chooseCutTransitions(built, { talk: file }, { workDir: join(dir, "frames"), threshold: 1.5 })).rejects.toThrow("transitions.autoThreshold must be between 0 and 1, got 1.5.");
  }, 60_000);
});
