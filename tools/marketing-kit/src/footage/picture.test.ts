import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Edl } from "./edl.js";
import { buildPictureConcatArgs, buildPictureList, buildPicturePieceArgs, getPictureFrames, planFootagePicture } from "./picture.js";

const edl: Edl = {
  version: 2,
  film: "street",
  segments: [
    { id: "s1", clip: "talk", start: 0.5, end: 2.51, transition: "cut", motion: "none" },
    { id: "s2", clip: "talk", start: 3, end: 4.013, transition: "zoom", motion: "none" },
    { id: "r1", clip: "street", start: 0, end: 3, transition: "fade", motion: "kenburns" },
    { id: "s3", clip: "talk", start: 7, end: 8.2, transition: "fade", motion: "none" },
  ],
};

const clips = { talk: "clips/talk.mp4", street: "clips/street.mp4" };
const frame = { width: 1080, height: 1920 };

describe("planFootagePicture", () => {
  it("lays every segment on film frames, from its start to the next segment's, without a gap", () => {
    const pieces = planFootagePicture({}, edl);
    // Starts 0, 2.01, 3.023, 6.023 s; the cut ends at 7.223 s (frame 217).
    expect(pieces.map((piece) => [piece.frame, piece.frames])).toEqual([
      [0, 60],
      [60, 31],
      [91, 90],
      [181, 36],
    ]);
    expect(getPictureFrames(pieces)).toBe(217);
    expect(pieces.map((piece) => [piece.clip, piece.start])).toEqual([
      ["talk", 0.5],
      ["talk", 3],
      ["street", 0],
      ["talk", 7],
    ]);
  });

  it("gives a fade cut the outgoing segment's tail, held at the zoom it ends on", () => {
    const pieces = planFootagePicture({}, edl);
    expect(pieces[0]?.fade).toBeNull();
    expect(pieces[1]?.fade).toBeNull();
    // Out of the zoomed segment (108 %), ten frames by default.
    expect(pieces[2]?.fade).toEqual({ clip: "talk", start: 4.013, frames: 10, scale: 1.08, origin: { x: 0.5, y: 0.42 } });
    // Out of a Ken Burns segment at scale 1: it ends 4 % in (a hand edit's Ken Burns).
    expect(pieces[3]?.fade).toEqual({ clip: "street", start: 3, frames: 10, scale: 1.04, origin: { x: 0.5, y: 0.42 } });
  });

  it("follows the film's edit: fade length and Ken Burns size", () => {
    const pieces = planFootagePicture({ edit: { fadeFrames: 6, kenBurnsPercent: 10 } }, edl);
    expect(pieces[3]?.fade).toEqual({ clip: "street", start: 3, frames: 6, scale: 1.1, origin: { x: 0.5, y: 0.42 } });
  });

  it("never lets a fade outlast its piece", () => {
    const short: Edl = {
      ...edl,
      segments: [
        { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" },
        { id: "s2", clip: "street", start: 0, end: 0.1, transition: "fade", motion: "none" },
      ],
    };
    expect(planFootagePicture({}, short)[1]?.fade?.frames).toBe(3);
  });

  it("throws on an EDL without segments", () => {
    expect(() => planFootagePicture({}, { ...edl, segments: [] })).toThrow("The EDL has no segments.");
  });
});

describe("buildPicturePieceArgs", () => {
  it("cuts a plain piece from one input, exactly its frames, without sound", () => {
    const [, second] = planFootagePicture({}, edl);
    const args = buildPicturePieceArgs({ piece: second!, clips, frame, output: "out/001.mp4" });
    expect(args.filter((arg) => arg === "-i")).toHaveLength(1);
    expect(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 6)).toEqual(["-ss", "3", "-t", "1.067", "-i", "clips/talk.mp4"]);
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph).toBe("[0:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1,tpad=stop_mode=clone:stop_duration=1.033,trim=end_frame=31,setpts=PTS-STARTPTS,settb=1/30,fps=30[picture]");
    expect(args).toContain("-an");
    expect(args.slice(args.indexOf("-frames:v"), args.indexOf("-frames:v") + 2)).toEqual(["-frames:v", "31"]);
    expect(args.slice(args.indexOf("-preset"), args.indexOf("-preset") + 4)).toEqual(["-preset", "veryfast", "-crf", "18"]);
    expect(args.at(-1)).toBe("out/001.mp4");
  });

  it("dissolves a fade piece from the outgoing tail, cropped to its zoom about 50 % 42 %", () => {
    const pieces = planFootagePicture({}, edl);
    const args = buildPicturePieceArgs({ piece: pieces[2]!, clips, frame, output: "out/002.mp4" });
    const inputs = args.flatMap((arg, index) => (arg === "-i" ? [args[index + 1]] : []));
    expect(inputs).toEqual(["clips/street.mp4", "clips/talk.mp4"]);
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[1:v]crop=iw/1.08:ih/1.08:(iw-iw/1.08)*0.5:(ih-ih/1.08)*0.42,scale=1080:1920,setpts=PTS-STARTPTS");
    expect(graph).toContain("trim=end_frame=10,setpts=PTS-STARTPTS,settb=1/30,fps=30[outgoing]");
    expect(graph).toContain("[outgoing][incoming]xfade=transition=fade:duration=0.333:offset=0,trim=end_frame=90[picture]");
  });

  it("leaves an unzoomed tail uncropped", () => {
    const short: Edl = {
      ...edl,
      segments: [
        { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" },
        { id: "s2", clip: "street", start: 0, end: 2, transition: "fade", motion: "none" },
      ],
    };
    const graph = buildPicturePieceArgs({ piece: planFootagePicture({}, short)[1]!, clips, frame, output: "o.mp4" }).join(" ");
    expect(graph).not.toContain("crop=");
  });

  it("encodes with the normalize encoder's preset and threads", () => {
    const pieces = planFootagePicture({}, edl);
    const args = buildPicturePieceArgs({ piece: pieces[2]!, clips, frame, output: "o.mp4", encoder: { preset: "ultrafast", threads: 1 } });
    expect(args.slice(3, 5)).toEqual(["-filter_complex_threads", "1"]);
    expect(args.filter((arg) => arg === "-threads")).toHaveLength(3);
    expect(args[args.indexOf("-preset") + 1]).toBe("ultrafast");
    expect(() => buildPicturePieceArgs({ piece: pieces[0]!, clips, frame, output: "o.mp4", encoder: { threads: 0 } })).toThrow("normalize.threads must be a positive whole number, got 0.");
  });

  it("throws when a clip has no file", () => {
    const [first] = planFootagePicture({}, edl);
    expect(() => buildPicturePieceArgs({ piece: first!, clips: { street: "s.mp4" }, frame, output: "o.mp4" })).toThrow('No file for clip "talk" of the EDL.');
  });
});

describe("the picture's join", () => {
  it("lists the pieces for the concat demuxer, quotes escaped", () => {
    expect(buildPictureList(["/b/000.mp4", "/b/it's/001.mp4"])).toBe("file '/b/000.mp4'\nfile '/b/it'\\''s/001.mp4'\n");
  });

  it("joins by stream copy with fast start", () => {
    expect(buildPictureConcatArgs("list.txt", "picture.mp4")).toEqual(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart", "picture.mp4"]);
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

describe.skipIf(!hasFfmpeg)("buildPicturePieceArgs with ffmpeg", () => {
  let dir = "";
  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  it("renders a fade from a zoomed tail at the clip's frame (issue #1057)", () => {
    dir = mkdtempSync(join(tmpdir(), "picture-"));
    const clip = join(dir, "clip.mp4");
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=30:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", clip], { encoding: "utf8" });
    expect(made.status, made.stderr).toBe(0);
    const zoomed: Edl = {
      ...edl,
      segments: [
        { id: "s1", clip: "talk", start: 0, end: 1, transition: "cut", motion: "none" },
        { id: "s2", clip: "talk", start: 1, end: 2, transition: "fade", motion: "none" },
      ],
    };
    // A 1.11 zoom crops 1080x1920 to 972.97 wide; scaled by the factor it came back 1078 wide and xfade refused it.
    const [, piece] = planFootagePicture({}, zoomed);
    const output = join(dir, "piece.mp4");
    const args = buildPicturePieceArgs({ piece: { ...piece!, fade: { ...piece!.fade!, scale: 1.11 } }, clips: { talk: clip }, frame, output, encoder: { preset: "ultrafast" } });
    const run = spawnSync("ffmpeg", args, { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const probed = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-count_frames", "-show_entries", "stream=width,height,nb_read_frames", "-of", "csv=p=0", output], { encoding: "utf8" });
    expect(probed.stdout.trim()).toBe(`1080,1920,${piece!.frames}`);
  });
});
