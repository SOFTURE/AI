import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { composeFootage, getSegmentScales } from "./compose.js";
import { buildFootageDraftArgs, planFootageDraft } from "./draft.js";
import {
  DRAWN_TRANSITION_FRAMES,
  DRAWN_TRANSITIONS,
  STUTTER_FRAMES,
  STUTTER_SCALE,
  buildDrawnTransitionFilters,
  getCardFrame,
  getTransitionOverlapFrames,
  isDrawnTransition,
  type DrawnTransition,
} from "./drawn-transitions.js";
import { validateEdl, type Edl, type EdlSegment } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { buildPicturePieceArgs, planFootagePicture } from "./picture.js";

const FRAME = { width: 1080, height: 1920 };

const twoShots = (transition: EdlSegment["transition"], extra: Partial<EdlSegment> = {}): Edl => ({
  version: 2,
  film: "street",
  segments: [
    { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" },
    { id: "s2", clip: "street", start: 0, end: 2, transition, motion: "none", ...extra },
  ],
});

const clips = [
  { id: "talk", duration: 8 },
  { id: "street", duration: 8 },
];

describe("drawn transitions", () => {
  it("names the drawn transitions and their frames", () => {
    expect(DRAWN_TRANSITIONS).toEqual(["whip", "card", "paper"]);
    expect(DRAWN_TRANSITION_FRAMES).toEqual({ whip: 14, card: 13, paper: 12 });
    expect(isDrawnTransition("whip")).toBe(true);
    expect(isDrawnTransition("fade")).toBe(false);
    expect(isDrawnTransition("stutter")).toBe(false);
  });

  it("gives the overlap of a fade, a drawn transition and a plain cut", () => {
    expect(getTransitionOverlapFrames({ transition: "fade" }, 10)).toBe(10);
    expect(getTransitionOverlapFrames({ transition: "fade", fadeFrames: 3 }, 10)).toBe(3);
    expect(getTransitionOverlapFrames({ transition: "card" }, 10)).toBe(13);
    expect(getTransitionOverlapFrames({ transition: "cut" }, 10)).toBe(0);
    expect(getTransitionOverlapFrames({ transition: "stutter" }, 10)).toBe(0);
  });

  it("grows the card from a quarter of the frame, tilted, to the full frame, eased out", () => {
    expect(getCardFrame(0)).toEqual({ scale: 0.3609, tilt: 0.0446, corner: 0.0298 });
    expect(getCardFrame(6)).toEqual({ scale: 0.8402, tilt: 0.0112, corner: 0.0075 });
    expect(getCardFrame(12)).toEqual({ scale: 1, tilt: 0, corner: 0 });
    // Eased out: the first steps are the largest.
    expect(getCardFrame(1).scale - getCardFrame(0).scale).toBeGreaterThan(getCardFrame(11).scale - getCardFrame(10).scale);
  });

  it("builds a whip of 8 outgoing and 6 incoming frames, its blur growing then falling, landing from 110 %", () => {
    const filters = buildDrawnTransitionFilters({ kind: "whip", outgoing: "a", incoming: "b", output: "o", frame: FRAME, prefix: "w" }).join(";");
    expect(filters).toContain("[a]trim=end_frame=8,");
    expect(filters).toContain("[b]trim=start_frame=8:end_frame=14,");
    expect(filters).toContain("crop=w=1080:h=1920:x='1080*0.6*pow(n/7,2)':y=0");
    expect(filters).toContain("gblur=sigma=54:sigmaV=0:enable='eq(n,7)'");
    expect(filters).toContain("gblur=sigma=45.36:sigmaV=0:enable='eq(n,0)'");
    expect(filters).toContain("zoompan=z='1.1-0.1*(1-pow(1-on/5,2))'");
    expect(filters).not.toContain("enable='eq(n,5)'),gblur");
    expect(filters.endsWith("concat=n=2:v=1:a=0,format=yuv420p,setsar=1,settb=1/30,setpts=N[o]")).toBe(true);
  });

  it("builds a card of one chain a frame, rounded and tilted until the last, laid over the outgoing shot", () => {
    const filters = buildDrawnTransitionFilters({ kind: "card", outgoing: "a", incoming: "b", output: "o", frame: FRAME, prefix: "c" });
    expect(filters[0]).toBe(`[b]trim=end_frame=13,setpts=PTS-STARTPTS,format=yuva420p,split=13${Array.from({ length: 13 }, (_, k) => `[cs${k}]`).join("")}`);
    expect(filters[1]).toContain("scale=388:692");
    expect(filters[1]).toContain("rotate=0.0446");
    expect(filters[1]).toContain("geq=");
    // The last frame is the incoming shot itself: full size, no corner, no tilt.
    expect(filters[13]).toBe("[cs12]trim=start_frame=12:end_frame=13,scale=1080:1920,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1[cc12]");
    expect(filters[14]).toContain("interleave=nb_inputs=13[ccard]");
    expect(filters.at(-1)).toBe("[cunder][ccard]overlay=0:0:format=auto,format=yuv420p,setsar=1,settb=1/30,setpts=N[o]");
  });

  it("builds a paper of a static grain over the outgoing shot and a torn edge opening from the middle", () => {
    const filters = buildDrawnTransitionFilters({ kind: "paper", outgoing: "a", incoming: "b", output: "o", frame: FRAME, prefix: "p" }).join(";");
    expect(filters).toContain("color=c=0xEDE6D8:s=1080x1920:r=30,trim=end_frame=12,format=yuv420p,noise=c0s=28:c0f=a,gblur=sigma=1.2:sigmaV=3");
    expect(filters).not.toContain("c0f=t");
    expect(filters).toContain("if(lt(N,4),-1,0.62*(0.5-0.5*cos(PI*(N-4+1)/8)))");
    expect(filters).toContain("0.035*sin(Y/H*31+1.3)");
    expect(filters).toContain("if(lt(");
    expect(filters.endsWith("format=yuv420p,setsar=1,settb=1/30,setpts=N[o]")).toBe(true);
  });
});

describe("the EDL with drawn transitions and a stutter", () => {
  it("accepts each drawn transition and a stutter on a long enough segment", () => {
    for (const transition of [...DRAWN_TRANSITIONS, "stutter"] as const) expect(validateEdl(twoShots(transition), clips, "street")).toEqual([]);
    expect(validateEdl(twoShots("stutter", { camera: { from: 1.4, to: 1.4, ease: "linear" } }), clips, "street")).toEqual([]);
  });

  it("refuses a drawn transition longer than its segment", () => {
    const edl = twoShots("whip", { end: 0.4 });
    expect(validateEdl(edl, clips, "street")).toEqual(["segments[1].transition: a whip takes 14 frames, longer than the segment (12 frames)"]);
  });

  it("refuses a stutter that a camera or a Ken Burns zoom would move, or one longer than its segment", () => {
    expect(validateEdl(twoShots("stutter", { camera: { from: 1, to: 1.2, ease: "linear" } }), clips, "street")).toEqual(["segments[1].transition: a stutter holds one tight framing; the segment's camera moves"]);
    expect(validateEdl(twoShots("stutter", { motion: "kenburns" }), clips, "street")).toEqual(["segments[1].transition: a stutter holds one tight framing; the segment's Ken Burns zoom would move it"]);
    expect(validateEdl(twoShots("stutter", { end: 0.15 }), clips, "street")).toEqual(["segments[1]: shorter than 0.25 s (start 0, end 0.15)", "segments[1].transition: a stutter shows 5 wide frames first, longer than the segment (5 frames)"]);
  });
});

describe("drawing a drawn transition", () => {
  it("gives the render's picture the outgoing tail of a drawn transition, and a plain cut to a piece too short for it", () => {
    const [, piece] = planFootagePicture({}, twoShots("paper"));
    expect(piece?.fade).toEqual({ kind: "paper", clip: "talk", start: 2, frames: 12, scale: 1, origin: { x: 0.5, y: 0.42 } });
    const [, short] = planFootagePicture({}, twoShots("whip", { end: 0.4 }));
    expect(short?.fade).toBeNull();
  });

  it("blends the tail into the picture piece and keeps the piece's length", () => {
    const [, piece] = planFootagePicture({}, twoShots("whip"));
    const args = buildPicturePieceArgs({ piece: piece!, clips: { talk: "talk.mp4", street: "street.mp4" }, frame: FRAME, output: "out.mp4" });
    const graph = args[args.indexOf("-filter_complex") + 1] as string;
    expect(graph).toContain("[full1]trim=end_frame=14,setpts=PTS-STARTPTS,settb=1/30,setpts=N[incoming]");
    expect(graph).toContain("[full2]trim=start_frame=14,setpts=PTS-STARTPTS,settb=1/30,setpts=N[rest]");
    expect(graph).toContain("[blend][rest]concat=n=2:v=1:a=0,settb=1/30,fps=30[picture]");
    expect(graph).not.toContain("xfade");
    expect(args[args.indexOf("-frames:v") + 1]).toBe("60");
  });

  it("plans the draft's overlap like a fade's and joins the drawn transition by a split, a blend and a concat", () => {
    const edl = twoShots("card");
    const plans = planFootageDraft({}, edl);
    expect(plans[0]?.seconds).toBe(2.433);
    expect(plans[1]).toMatchObject({ fade: 0, drawn: { kind: "card", frames: 13 }, isStutter: false });
    const args = buildFootageDraftArgs({ film: {}, edl, clips: { talk: "talk.mp4", street: "street.mp4" }, speech: "speech.m4a", frame: FRAME, captions: null, fontsDir: null, output: "draft.mp4" });
    const graph = args[args.indexOf("-filter_complex") + 1] as string;
    expect(graph).toContain("[v0]split[d1a][d1b]");
    expect(graph).toContain("[d1b]trim=start_frame=60:end_frame=73,setpts=PTS-STARTPTS,settb=1/30,setpts=N[d1tail]");
    expect(graph).toContain("[d1head][d1blend][d1rest]concat=n=3:v=1:a=0,settb=1/30,fps=30[j1]");
    expect(graph).toContain("scale=194:346");
  });

  it("holds a stutter's full frame for its first frames in the draft and the composition, then its framing", () => {
    const edl = twoShots("stutter");
    expect(getSegmentScales(edl)).toEqual([1, STUTTER_SCALE]);
    const framed = twoShots("stutter", { camera: { from: 1.4, to: 1.4, ease: "linear" } });
    expect(getSegmentScales(framed)).toEqual([1, 1.4]);
    const args = buildFootageDraftArgs({ film: {}, edl, clips: { talk: "talk.mp4", street: "street.mp4" }, speech: "speech.m4a", frame: FRAME, captions: null, fontsDir: null, output: "draft.mp4" });
    expect(args[args.indexOf("-filter_complex") + 1]).toContain(`zoompan=z='if(lt(on,${STUTTER_FRAMES}),1,1.5)'`);
    const html = composeStutter(edl, true);
    expect(html).toContain(`tl.set("#picture", { scale: 1 }, 2);`);
    expect(html).toContain(`tl.set("#picture", { scale: 1.5 }, 2.167);`);
    const perSegment = composeStutter(edl, false);
    expect(perSegment).toContain(`tl.set("#seg1", { scale: 1 }, 2);`);
    expect(perSegment).toContain(`tl.set("#seg1", { scale: 1.5 }, 2.167);`);
  });
});

function composeStutter(edl: Edl, hasPicture: boolean): string {
  const film = { id: "street", title: "Street", format: "9:16", language: "pl", clips: [], isolateVoice: false, cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null }, transitions: DEFAULT_TRANSITIONS, music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 }, captions: false, endCard: null } as unknown as FootageFilm;
  return composeFootage({
    film,
    edl,
    words: [],
    frame: FRAME,
    caption: { left: 60, right: 60, bottom: 300, fontSize: 60 } as never,
    headlineSize: 90,
    colors: { foreground: "#fff", background: "#000", muted: "#999", cta: "#f00", onCta: "#fff", captionBackground: "#000", captionText: "#fff", captionHighlight: "#ff0" } as never,
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "assets/talk.mp4", street: "assets/street.mp4" }, ...(hasPicture ? { picture: "assets/picture.mp4" } : {}), speech: "assets/speech.m4a", music: null, lastFrame: "assets/last.png", logo: null, sfx: {} },
    brandName: "Brand",
    locale: "pl",
  });
}

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

describe.skipIf(!hasFfmpeg)("drawn transitions with ffmpeg: the draft and the render's picture draw the same frames", () => {
  let dir = "";
  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  const SMALL = { width: 216, height: 384 };

  function make(name: string, source: string): string {
    const file = join(dir, `${name}.mp4`);
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `${source.endsWith(":") ? source : `${source}=`}s=${SMALL.width}x${SMALL.height}:r=30:d=4`, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "1", "-pix_fmt", "yuv420p", file], { encoding: "utf8" });
    if (made.status !== 0) throw new Error(`making ${name} failed: ${made.stderr}`);
    return file;
  }

  /** Every frame of a video as raw grey pixels at 54x96. */
  function readFrames(file: string): Buffer[] {
    const run = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale=54:96", "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
    const size = 54 * 96;
    const frames: Buffer[] = [];
    for (let at = 0; at + size <= run.stdout.length; at += size) frames.push(run.stdout.subarray(at, at + size));
    return frames;
  }

  function diff(a: Buffer | undefined, b: Buffer | undefined): number {
    if (a === undefined || b === undefined) return Number.POSITIVE_INFINITY;
    let sum = 0;
    for (let index = 0; index < a.length; index++) sum += Math.abs((a[index] ?? 0) - (b[index] ?? 0));
    return sum / a.length;
  }

  it.each(DRAWN_TRANSITIONS.map((kind) => [kind]))("draws a %s alike in the draft and the picture, in between both shots, ending on the incoming one", (kind: DrawnTransition) => {
    dir = mkdtempSync(join(tmpdir(), "drawn-"));
    const files = { talk: make("talk", "testsrc2"), street: make("street", "smptehdbars") };
    const speech = join(dir, "speech.m4a");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "4", "-c:a", "aac", speech]).status).toBe(0);
    const edl = twoShots(kind);
    const frames = DRAWN_TRANSITION_FRAMES[kind];

    const draftFile = join(dir, "draft.mp4");
    const draft = spawnSync("ffmpeg", buildFootageDraftArgs({ film: {}, edl, clips: files, speech, frame: SMALL, width: SMALL.width, captions: null, fontsDir: null, output: draftFile }), { encoding: "utf8" });
    expect(draft.status, draft.stderr).toBe(0);
    const pieceFile = join(dir, "piece.mp4");
    const [, piece] = planFootagePicture({}, edl);
    const picture = spawnSync("ffmpeg", buildPicturePieceArgs({ piece: piece!, clips: files, frame: SMALL, output: pieceFile, encoder: { preset: "ultrafast" } }), { encoding: "utf8" });
    expect(picture.status, picture.stderr).toBe(0);

    const drafted = readFrames(draftFile);
    const pictured = readFrames(pieceFile);
    expect(drafted).toHaveLength(120);
    expect(pictured).toHaveLength(60);
    const talkFrames = readFrames(files.talk);
    const streetFrames = readFrames(files.street);
    for (let k = 0; k < frames; k++) expect(diff(drafted[60 + k], pictured[k]), `frame ${String(k)}`).toBeLessThan(6);
    // Mid-transition the picture is neither shot; once it is over, the incoming shot as it is.
    const half = Math.floor(frames / 2);
    expect(diff(drafted[60 + half], talkFrames[60 + half])).toBeGreaterThan(8);
    expect(diff(drafted[60 + half], streetFrames[half])).toBeGreaterThan(8);
    expect(diff(drafted[60 + frames + 2], streetFrames[frames + 2])).toBeLessThan(4);
  }, 120_000);

  it.each(DRAWN_TRANSITIONS.map((kind) => [kind]))("draws a %s without a coloured fringe between a black and a grey shot", (kind: DrawnTransition) => {
    dir = mkdtempSync(join(tmpdir(), "drawn-"));
    // A transparent pixel left at zero chroma shows green where it is blended into a yuv420p frame.
    const files = { talk: make("talk", "color=c=black:"), street: make("street", "color=c=gray:") };
    const speech = join(dir, "speech.m4a");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "4", "-c:a", "aac", speech]).status).toBe(0);
    const draftFile = join(dir, "draft.mp4");
    const draft = spawnSync("ffmpeg", buildFootageDraftArgs({ film: {}, edl: twoShots(kind), clips: files, speech, frame: SMALL, width: SMALL.width, captions: null, fontsDir: null, output: draftFile }), { encoding: "utf8" });
    expect(draft.status, draft.stderr).toBe(0);

    const run = spawnSync("ffmpeg", ["-v", "error", "-i", draftFile, "-vf", "select='between(n,60,79)'", "-vsync", "0", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 64 * 1024 * 1024 });
    let tinted = 0;
    for (let at = 0; at + 2 < run.stdout.length; at += 3) {
      const [red = 0, green = 0, blue = 0] = run.stdout.subarray(at, at + 3);
      if (Math.abs(red - green) > 20 || Math.abs(green - blue) > 20 || Math.abs(red - blue) > 20) tinted++;
    }
    expect(run.stdout.length).toBe(20 * SMALL.width * SMALL.height * 3);
    // Only the paper is tinted on purpose (its warm grain); a black and a grey shot carry no colour of their own.
    if (kind !== "paper") expect(tinted).toBe(0);
  }, 120_000);
});
