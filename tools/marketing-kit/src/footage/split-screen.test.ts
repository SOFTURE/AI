import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { composeFootage } from "./compose.js";
import { buildFootageDraftArgs, planFootageDraft } from "./draft.js";
import { diffEdl, readEdl, validateEdl, type Edl, type EdlSegment } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { resolveEdlOverlays } from "./overlays.js";
import { buildPicturePieceArgs, planFootagePicture } from "./picture.js";
import {
  MAX_SPLIT_LABEL_CHARACTERS,
  buildSplitScreenFilters,
  findSplitCaptionProblems,
  findSplitLabelProblems,
  getSplitArrowPaths,
  getSplitBandHeights,
  getSplitCaption,
  getSplitLayerInputArgs,
  getSplitLayerSvg,
  getSplitPlaces,
  renderSplitLayerPng,
  splitSchema,
  writeSplitLayers,
  type EdlSplit,
} from "./split-screen.js";

const FRAME = { width: 1080, height: 1920 };

const SPLIT: EdlSplit = {
  layout: "split3",
  bands: [
    { clip: "north", start: 0, label: "North beach" },
    { clip: "harbour", start: 1, label: "Harbour", focus: 0.2 },
    { clip: "hill", start: 0.5, label: "Hill & café" },
  ],
};

const clips = [
  { id: "talk", duration: 8 },
  { id: "north", duration: 8 },
  { id: "harbour", duration: 8 },
  { id: "hill", duration: 8 },
];

/** A talking shot, the split over its speech, and the talking shot again. */
const withSplit = (split: Partial<EdlSegment> = {}, after: Partial<EdlSegment> = {}): Edl => ({
  version: 2,
  film: "towns",
  segments: [
    { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" },
    { id: "r1", clip: "north", start: 0, end: 2, transition: "cut", motion: "none", audio: { clip: "talk", start: 2, end: 4, ownVolume: 0 }, split: SPLIT, ...split },
    { id: "s2", clip: "talk", start: 4, end: 6, transition: "cut", motion: "none", ...after },
  ],
});

const BOUNDS = { frameHeight: 1920, cardHeight: 104 };

describe("the split screen's shape", () => {
  it("reads a split3 with three labelled bands and refuses two bands, an empty, a long or a two-line label and a focus past the shot", () => {
    expect(splitSchema.safeParse(SPLIT).success).toBe(true);
    const bands = SPLIT.bands;
    expect(splitSchema.safeParse({ layout: "split3", bands: [bands[0], bands[1]] }).success).toBe(false);
    expect(splitSchema.safeParse({ layout: "split2", bands }).success).toBe(false);
    const withLabel = (label: string) => ({ layout: "split3", bands: [{ ...bands[0], label }, bands[1], bands[2]] });
    expect(splitSchema.safeParse(withLabel("  ")).success).toBe(false);
    expect(splitSchema.safeParse(withLabel("x".repeat(MAX_SPLIT_LABEL_CHARACTERS))).success).toBe(true);
    expect(splitSchema.safeParse(withLabel("x".repeat(MAX_SPLIT_LABEL_CHARACTERS + 1))).success).toBe(false);
    expect(splitSchema.safeParse(withLabel("one\ntwo")).success).toBe(false);
    expect(splitSchema.safeParse({ layout: "split3", bands: [{ ...bands[0], focus: 1.2 }, bands[1], bands[2]] }).success).toBe(false);
  });

  it("cuts the frame into three even bands, the last one taking what rounding leaves", () => {
    expect(getSplitBandHeights(FRAME)).toEqual([640, 640, 640]);
    expect(getSplitBandHeights({ width: 540, height: 960 })).toEqual([320, 320, 320]);
    expect(getSplitBandHeights({ width: 1080, height: 1350 })).toEqual([450, 450, 450]);
    expect(getSplitBandHeights({ width: 216, height: 386 })).toEqual([128, 128, 130]);
  });

  it("zig-zags the labels: the top band's low on the left, the middle band's high on the right, the bottom band's high on the left", () => {
    const [top, middle, bottom] = getSplitPlaces(FRAME);
    expect(top).toEqual({ band: { x: 0, y: 0, width: 1080, height: 640 }, side: "left", labelX: 64, labelY: 499, arrowTo: { x: 605, y: 269 }, reserved: { top: 269, bottom: 520 } });
    expect(middle).toEqual({ band: { x: 0, y: 640, width: 1080, height: 640 }, side: "right", labelX: 1016, labelY: 794, arrowTo: { x: 454, y: 934 }, reserved: { top: 734, bottom: 934 } });
    expect(bottom).toEqual({ band: { x: 0, y: 1280, width: 1080, height: 640 }, side: "left", labelX: 64, labelY: 1421, arrowTo: { x: 626, y: 1549 }, reserved: { top: 1361, bottom: 1549 } });
    // Clear of the platform's header (220 px) and its buttons (the last 420 px).
    expect(top.reserved.top).toBeGreaterThan(220);
    expect(bottom.reserved.bottom).toBeLessThan(1920 - 300);
  });

  it("refuses a label wider than half the frame, at any size", () => {
    expect(findSplitLabelProblems(SPLIT, FRAME, "split")).toEqual([]);
    const wide: EdlSplit = { ...SPLIT, bands: [SPLIT.bands[0], { ...SPLIT.bands[1], label: "WWWWWWWWWWWWWWWWWWWWWWWW" }, SPLIT.bands[2]] };
    const problems = findSplitLabelProblems(wide, FRAME, "split");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^split\.bands\[1\]\.label: "W{24}" is \d+ px wide, more than 540 px; shorten it$/);
    expect(findSplitLabelProblems(wide, { width: 540, height: 960 }, "split")[0]).toMatch(/more than 270 px/);
  });
});

describe("the split screen's layer", () => {
  it("draws a curved arrow ending on its target with a two-stroke head", () => {
    const { curve, head } = getSplitArrowPaths({ x: 100, y: 100 }, { x: 400, y: 100 }, 1);
    expect(curve).toBe("M100 100 C190 166 316 152.8 400 100");
    expect(head.match(/L400 100/g)).toHaveLength(2);
    // A zero-length arrow does not divide by zero.
    expect(getSplitArrowPaths({ x: 5, y: 5 }, { x: 5, y: 5 }, 1).curve).toBe("M5 5 C5 5 5 5 5 5");
  });

  it("lays two lines between the bands and each label with its arrow, escaped, in the hand font", () => {
    const svg = getSplitLayerSvg({ ...SPLIT, bands: [SPLIT.bands[0], { ...SPLIT.bands[1], label: `A<b>"` }, SPLIT.bands[2]] }, FRAME);
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">`)).toBe(true);
    expect(svg.match(/<rect /g)).toHaveLength(2);
    expect(svg).toContain(`<rect x="0" y="638" width="1080" height="4" fill="#111111"/>`);
    expect(svg).toContain(`text-anchor="start" font-family="Caveat" font-weight="600" font-size="60" fill="#ffffff">North beach</text>`);
    expect(svg).toContain(`<text x="1016" y="794" text-anchor="end"`);
    expect(svg).toContain(">A&lt;b&gt;&quot;</text>");
    expect(svg).toContain(">Hill &amp; café</text>");
    expect(svg.match(/<g filter="url\(#shadow\)">/g)).toHaveLength(3);
    // Half the size at half the width.
    expect(getSplitLayerSvg(SPLIT, { width: 540, height: 960 })).toContain(`font-size="30"`);
  });

  it("renders the layer as a transparent PNG of the frame's size with the labels drawn", () => {
    const png = renderSplitLayerPng(SPLIT, { width: 216, height: 384 });
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(216);
    expect(png.readUInt32BE(20)).toBe(384);
    // An RGBA image (colour type 6) with more than a blank layer's bytes.
    expect(png[25]).toBe(6);
    expect(png.length).toBeGreaterThan(2000);
  });

  it("writes one layer per split segment, by segment id, joined to its folder or bare", () => {
    const dir = mkdtempSync(join(tmpdir(), "split-layers-"));
    try {
      const files = writeSplitLayers(withSplit().segments, { width: 216, height: 384 }, dir);
      expect(files).toEqual({ r1: join(dir, "split-r1.png") });
      expect(existsSync(join(dir, "split-r1.png"))).toBe(true);
      expect(writeSplitLayers(withSplit().segments, { width: 216, height: 384 }, dir, true)).toEqual({ r1: "split-r1.png" });
      expect(writeSplitLayers([{ id: "s1" }], { width: 216, height: 384 }, dir)).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("crops each shot to its band at its focus, stacks the three and lays the layer over them", () => {
    const filters = buildSplitScreenFilters({ inputs: ["0:v", "1:v", "2:v"], layer: "3:v", split: SPLIT, frame: { width: 540, height: 960 }, fit: ["fps=30"], output: "out", prefix: "p" });
    expect(filters).toEqual([
      "[0:v]scale=540:320:force_original_aspect_ratio=increase,crop=540:320:(iw-ow)/2:(ih-oh)*0.5,setsar=1,fps=30[pb0]",
      "[1:v]scale=540:320:force_original_aspect_ratio=increase,crop=540:320:(iw-ow)/2:(ih-oh)*0.2,setsar=1,fps=30[pb1]",
      "[2:v]scale=540:320:force_original_aspect_ratio=increase,crop=540:320:(iw-ow)/2:(ih-oh)*0.5,setsar=1,fps=30[pb2]",
      "[pb0][pb1][pb2]vstack=inputs=3[pstack]",
      "[3:v]format=rgba[player]",
      "[pstack][player]overlay=0:0:format=auto:shortest=1,format=yuv420p,setsar=1,settb=1/30,setpts=N,fps=30[out]",
    ]);
    expect(getSplitLayerInputArgs("layer.png", 2.5, 30)).toEqual(["-loop", "1", "-framerate", "30", "-t", "2.5", "-i", "layer.png"]);
  });
});

describe("the split screen's captions", () => {
  it("puts the captions' foot at 94 % of the middle band", () => {
    expect(getSplitCaption(FRAME)).toEqual({ bottom: 678 });
    expect(getSplitCaption({ width: 540, height: 960 })).toEqual({ bottom: 339 });
  });

  it("accepts captions in the middle band and refuses a missing box or one that covers a label or an arrow", () => {
    const check = (caption: { bottom?: number; top?: number } | undefined) => findSplitCaptionProblems({ at: "segments[1]", caption, frame: FRAME, cardHeight: 104 });
    expect(check(getSplitCaption(FRAME))).toEqual([]);
    expect(check({ top: 1000 })).toEqual([]);
    expect(check(undefined)).toEqual(["segments[1].caption: a split screen sets its own caption box, clear of its labels (bottom 678 px puts the captions in the middle band)"]);
    expect(check({})).toHaveLength(1);
    // The film's usual box (foot 420 px above the frame's foot) sits on the bottom band's arrow.
    expect(check({ bottom: 420 })).toEqual(["segments[1].caption: the captions (1292-1500 px) would cover band 3's label or arrow; bottom 678 px puts them in the middle band"]);
    expect(check({ top: 700 })).toEqual(["segments[1].caption: the captions (700-908 px) would cover band 2's label or arrow; bottom 678 px puts them in the middle band"]);
    expect(findSplitCaptionProblems({ at: "x", caption: { top: 300 }, frame: FRAME, cardHeight: 104, lines: 1 })[0]).toMatch(/band 1's/);
  });
});

describe("the EDL with a split screen", () => {
  it("reads and accepts a split over speech, and keeps an EDL without one as it was", () => {
    const edl = withSplit({ caption: getSplitCaption(FRAME) });
    const read = readEdl(JSON.parse(JSON.stringify(edl)));
    expect(read.ok && read.edl.segments[1]?.split).toEqual(SPLIT);
    expect(validateEdl(edl, clips, "towns")).toEqual([]);
    expect(validateEdl(edl, clips, "towns", BOUNDS)).toEqual([]);
    expect(validateEdl(withSplit({ split: undefined }), clips, "towns", BOUNDS)).toEqual([]);
  });

  it("refuses a band's unknown or too short clip", () => {
    const split: EdlSplit = { ...SPLIT, bands: [{ ...SPLIT.bands[0], clip: "nowhere" }, { ...SPLIT.bands[1], start: 7 }, SPLIT.bands[2]] };
    expect(validateEdl(withSplit({ split }), clips, "towns")).toEqual([
      'segments[1].split.bands[0].clip: no clip "nowhere" in the film',
      "segments[1].split.bands[1].end: 9 s is past the clip's end (8.00 s)",
    ]);
  });

  it("refuses a camera, Ken Burns, a zoom or a stutter on a split", () => {
    expect(validateEdl(withSplit({ camera: { from: 1, to: 1.1 } as never }), clips, "towns")).toContain("segments[1].split: a split screen holds still; drop the segment's camera");
    expect(validateEdl(withSplit({ motion: "kenburns" }), clips, "towns")).toContain("segments[1].split: a split screen holds still; set motion to none");
    expect(validateEdl(withSplit({ transition: "zoom" }), clips, "towns")).toEqual(["segments[1].split: a split screen holds still; start it on a cut or a fade, not a zoom"]);
    expect(validateEdl(withSplit({ transition: "stutter" }), clips, "towns")).toContain("segments[1].split: a split screen holds still; start it on a cut or a fade, not a stutter");
    expect(validateEdl(withSplit({ transition: "fade" }), clips, "towns")).toEqual([]);
  });

  it("refuses a split that ends the cut, and a fade or a drawn transition right after one", () => {
    const last: Edl = { ...withSplit(), segments: withSplit().segments.slice(0, 2) };
    expect(validateEdl(last, clips, "towns")).toEqual(["segments[1].split: a split screen cannot end the cut (the end card's backdrop is one shot); put a full shot after it"]);
    expect(validateEdl(withSplit({}, { transition: "fade" }), clips, "towns")).toEqual(['segments[1].split: the segment after a split screen starts on a fade; start "s2" on a cut']);
    expect(validateEdl(withSplit({}, { transition: "whip" }), clips, "towns")).toEqual(['segments[1].split: the segment after a split screen starts on a whip; start "s2" on a cut']);
    expect(validateEdl(withSplit({}, { transition: "zoom" }), clips, "towns")).toEqual([]);
  });

  it("measures the labels against a 9:16 frame by default, or the bounds' own width", () => {
    const split: EdlSplit = { ...SPLIT, bands: [{ ...SPLIT.bands[0], label: "WWWWWWWWWWWWWWWWWWWWWWWW" }, SPLIT.bands[1], SPLIT.bands[2]] };
    expect(validateEdl(withSplit({ split }), clips, "towns")[0]).toMatch(/^segments\[1\]\.split\.bands\[0\]\.label: .* more than 540 px; shorten it$/);
    expect(validateEdl(withSplit({ split, caption: { bottom: 339 } }), clips, "towns", { frameHeight: 960, cardHeight: 52, frameWidth: 540 })[0]).toMatch(/more than 270 px/);
  });

  it("with caption bounds, asks for the split's own caption box and refuses caption ranges on its labels", () => {
    expect(validateEdl(withSplit(), clips, "towns", BOUNDS)).toEqual(["segments[1].caption: a split screen sets its own caption box, clear of its labels (bottom 678 px puts the captions in the middle band)"]);
    const ranged: Edl = { ...withSplit({ caption: getSplitCaption(FRAME) }), captionRanges: [{ from: 0, to: 1.5, bottom: 420 }, { from: 2.5, to: 3, bottom: 420 }, { from: 3, to: 3.5, bottom: 678 }] };
    expect(validateEdl(ranged, clips, "towns", BOUNDS)).toEqual(["captionRanges[1]: the captions (1292-1500 px) would cover band 3's label or arrow; bottom 678 px puts them in the middle band"]);
  });

  it("says what an edit changed about a split", () => {
    const before = withSplit({ split: undefined });
    const after = withSplit();
    expect(diffEdl(before, after)).toContain('r1: split screen north "North beach", harbour "Harbour", hill "Hill & café"');
    expect(diffEdl(after, before)).toContain("r1: one shot again");
    const added: Edl = { ...after, segments: [after.segments[0]!, { ...after.segments[1]!, id: "r9" }, after.segments[2]!] };
    expect(diffEdl(before, added)).toContain("added r9 (north 0–2 s, split screen north, harbour, hill)");
  });

  it("keeps overlays off a split, the hook title too", () => {
    const film = { format: "9:16", captionPreset: "reels" } as unknown as FootageFilm;
    const edl: Edl = { ...withSplit({ caption: getSplitCaption(FRAME) }), overlays: [{ kind: "keyword", text: "Three towns", at: 2.5, duration: 1 } as never, { kind: "hook_title", text: "Where to stay", at: 0.2, duration: 1.5 } as never] };
    const resolved = resolveEdlOverlays({ edl, film, frame: FRAME, words: [], caption: { left: 60, right: 60, bottom: 420, fontSize: 64 } as never });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.problems).toEqual(['overlays[0]: segment "r1" is a split screen with its own labels and arrows; keep overlays off it']);
    const across: Edl = { ...edl, overlays: [{ kind: "hook_title", text: "Where to stay", at: 1.5, duration: 1 } as never] };
    const crossing = resolveEdlOverlays({ edl: across, film, frame: FRAME, words: [], caption: { left: 60, right: 60, bottom: 420, fontSize: 64 } as never });
    expect(crossing.ok ? [] : crossing.problems).toEqual(['overlays[0]: segment "r1" is a split screen with its own labels and arrows; keep overlays off it']);
  });
});

describe("drawing a split screen", () => {
  it("plans the split's picture piece with its bands and no tail of its own after it", () => {
    const pieces = planFootagePicture({}, withSplit());
    expect(pieces.map((piece) => piece.split)).toEqual([null, SPLIT, null]);
    expect(pieces[2]?.fade).toBeNull();
  });

  it("builds a split piece from its three bands and its layer, and refuses one without a layer", () => {
    const [, piece] = planFootagePicture({}, withSplit());
    const files = { talk: "talk.mp4", north: "north.mp4", harbour: "harbour.mp4", hill: "hill.mp4" };
    const args = buildPicturePieceArgs({ piece: piece!, clips: files, frame: FRAME, output: "out.mp4", splitLayer: "layer.png" });
    const inputs = args.flatMap((arg, index) => (arg === "-i" ? [args[index + 1]] : []));
    expect(inputs).toEqual(["north.mp4", "harbour.mp4", "hill.mp4", "layer.png"]);
    expect(args.slice(args.indexOf("-loop"), args.indexOf("-loop") + 6)).toEqual(["-loop", "1", "-framerate", "30", "-t", "2.033"]);
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[0:v]scale=1080:640:force_original_aspect_ratio=increase,crop=1080:640:(iw-ow)/2:(ih-oh)*0.5,setsar=1,setpts=PTS-STARTPTS");
    expect(graph).toContain("[spb0][spb1][spb2]vstack=inputs=3[spstack]");
    expect(graph.endsWith(";[split]null[picture]")).toBe(true);
    expect(args[args.indexOf("-ss") + 1]).toBe("0");
    expect(() => buildPicturePieceArgs({ piece: piece!, clips: files, frame: FRAME, output: "out.mp4" })).toThrow("A split piece needs its layer (splitLayer).");
  });

  it("fades into a split piece over the outgoing tail, and draws a drawn transition into one", () => {
    const files = { talk: "talk.mp4", north: "north.mp4", harbour: "harbour.mp4", hill: "hill.mp4" };
    const [, faded] = planFootagePicture({}, withSplit({ transition: "fade" }));
    const fade = buildPicturePieceArgs({ piece: faded!, clips: files, frame: FRAME, output: "out.mp4", splitLayer: "layer.png" });
    const fadeGraph = fade[fade.indexOf("-filter_complex") + 1] ?? "";
    expect(fade.filter((arg) => arg === "-i")).toHaveLength(5);
    expect(fadeGraph).toContain("[split]null[incoming];[4:v]");
    const [, whipped] = planFootagePicture({}, withSplit({ transition: "whip" }));
    const whip = buildPicturePieceArgs({ piece: whipped!, clips: files, frame: FRAME, output: "out.mp4", splitLayer: "layer.png" });
    const whipGraph = whip[whip.indexOf("-filter_complex") + 1] ?? "";
    expect(whipGraph).toContain("[split]null,split[full1][full2]");
    expect(whipGraph).toContain("[4:v]");
  });

  it("gives the draft three band inputs and a layer for the split, the sound after them, and refuses a split without its layer", () => {
    const files = { talk: "talk.mp4", north: "north.mp4", harbour: "harbour.mp4", hill: "hill.mp4" };
    const edl = withSplit();
    const args = buildFootageDraftArgs({ film: {}, edl, clips: files, speech: "speech.m4a", frame: FRAME, captions: null, fontsDir: null, splitLayers: { r1: "split-r1.png" }, output: "draft.mp4" });
    const inputs = args.flatMap((arg, index) => (arg === "-i" ? [args[index + 1]] : []));
    expect(inputs).toEqual(["talk.mp4", "north.mp4", "harbour.mp4", "hill.mp4", "split-r1.png", "talk.mp4", "speech.m4a"]);
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("[1:v]scale=540:320:force_original_aspect_ratio=increase");
    expect(graph).toContain("[sp1stack][sp1layer]overlay=0:0:format=auto:shortest=1,format=yuv420p,setsar=1,settb=1/30,setpts=N,fps=30[v1]");
    expect(graph).toContain("[5:v]setpts=PTS-STARTPTS");
    expect(args[args.indexOf("-map", args.indexOf("-map") + 1) + 1]).toBe("6:a");
    expect(planFootageDraft({}, edl)[1]?.seconds).toBe(2);
    expect(() => buildFootageDraftArgs({ film: {}, edl, clips: files, speech: "speech.m4a", frame: FRAME, captions: null, fontsDir: null, output: "draft.mp4" })).toThrow('No split layer for segment "r1" of the EDL.');
    expect(() => buildFootageDraftArgs({ film: {}, edl, clips: { talk: "talk.mp4" }, speech: "speech.m4a", frame: FRAME, captions: null, fontsDir: null, splitLayers: { r1: "x.png" }, output: "draft.mp4" })).toThrow('No file for clip "north" of the EDL.');
  });

  it("refuses to compose a split without the cut's picture", () => {
    const film = { id: "towns", title: "Towns", format: "9:16", language: "pl", clips: [], isolateVoice: false, cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null }, transitions: DEFAULT_TRANSITIONS, music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 }, captions: false, endCard: null } as unknown as FootageFilm;
    const compose = (hasPicture: boolean) =>
      composeFootage({
        film,
        edl: withSplit(),
        words: [],
        frame: FRAME,
        caption: { left: 60, right: 60, bottom: 300, fontSize: 60 } as never,
        headlineSize: 90,
        colors: { foreground: "#fff", background: "#000", muted: "#999", cta: "#f00", onCta: "#fff", captionBackground: "#000", captionText: "#fff", captionHighlight: "#ff0" } as never,
        fonts: { heading: null, body: null },
        assets: { clips: { talk: "a.mp4", north: "b.mp4", harbour: "c.mp4", hill: "d.mp4" }, ...(hasPicture ? { picture: "assets/picture.mp4" } : {}), speech: "s.m4a", music: null, lastFrame: "l.png", logo: null, sfx: {} },
        brandName: "Brand",
        locale: "pl",
      });
    expect(() => compose(false)).toThrow("The EDL has a split screen, which needs the cut's picture (assets.picture).");
    expect(compose(true)).toContain(`<video id="picture"`);
  });
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

describe.skipIf(!hasFfmpeg)("a split screen with ffmpeg: the draft and the render's picture draw the same picture", () => {
  let dir = "";
  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  const SMALL = { width: 216, height: 384 };

  function make(name: string, source: string, size = SMALL): string {
    const file = join(dir, `${name}.mp4`);
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `${source}=s=${String(size.width)}x${String(size.height)}:r=30:d=8`, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "1", "-pix_fmt", "yuv420p", file], { encoding: "utf8" });
    if (made.status !== 0) throw new Error(`making ${name} failed: ${made.stderr}`);
    return file;
  }

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

  it("draws the split alike in the draft and the picture, unlike any one shot, and the cut's frames add up", () => {
    dir = mkdtempSync(join(tmpdir(), "split-"));
    // A landscape shot in the middle band: its crop covers the band, so the picture never shows a bar.
    const files = { talk: make("talk", "testsrc2"), north: make("north", "smptehdbars"), harbour: make("harbour", "testsrc", { width: 384, height: 216 }), hill: make("hill", "rgbtestsrc") };
    const speech = join(dir, "speech.m4a");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "6", "-c:a", "aac", speech]).status).toBe(0);
    const edl = withSplit({ transition: "fade" });
    const layers = writeSplitLayers(edl.segments, SMALL, dir);

    const draftFile = join(dir, "draft.mp4");
    const draft = spawnSync("ffmpeg", buildFootageDraftArgs({ film: {}, edl, clips: files, speech, frame: SMALL, width: SMALL.width, captions: null, fontsDir: null, splitLayers: layers, output: draftFile }), { encoding: "utf8" });
    expect(draft.status, draft.stderr).toBe(0);
    const pieceFile = join(dir, "piece.mp4");
    const [, piece] = planFootagePicture({}, edl);
    const picture = spawnSync("ffmpeg", buildPicturePieceArgs({ piece: piece!, clips: files, frame: SMALL, output: pieceFile, encoder: { preset: "ultrafast" }, splitLayer: layers.r1 }), { encoding: "utf8" });
    expect(picture.status, picture.stderr).toBe(0);

    const drafted = readFrames(draftFile);
    const pictured = readFrames(pieceFile);
    expect(drafted).toHaveLength(180);
    expect(pictured).toHaveLength(60);
    // Past the fade, every frame of the split matches between the two paths.
    for (const k of [12, 30, 59]) expect(diff(drafted[60 + k], pictured[k]), `frame ${String(k)}`).toBeLessThan(4);
    for (const shot of [files.talk, files.north, files.hill]) expect(diff(drafted[90], readFrames(shot)[30])).toBeGreaterThan(10);
    // The talking shot comes back on a plain cut after the split.
    expect(diff(drafted[125], readFrames(files.talk)[125])).toBeLessThan(4);
    expect(readFileSync(layers.r1!).length).toBeGreaterThan(1000);
  }, 120_000);
});
