import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import {
  CAMERA_ORIGIN,
  MAX_CAMERA_SCALE,
  describeCamera,
  getCameraGsapEase,
  getCameraMoveFrames,
  getCameraMoveSeconds,
  getCameraOrigin,
  getCameraScaleAt,
  getCameraScaleExpression,
  isCameraMoving,
  isSameCamera,
  toTransformOrigin,
  type EdlCamera,
} from "./camera.js";
import { composeFootage, getSegmentFadeFrames, getSegmentScales, getSegmentZoomEases, type FootageComposeInput } from "./compose.js";
import { buildFootageDraftArgs, planFootageDraft, renderFootageDraft, type FootageDraftArgsInput } from "./draft.js";
import { diffEdl, readEdl, validateEdl, type Edl, type EdlSegment } from "./edl.js";
import { DEFAULT_EDIT, DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { findShotBreak, resolveEdlOverlays } from "./overlays.js";
import { buildPicturePieceArgs, planFootagePicture } from "./picture.js";
import type { PreparedClip } from "./pipeline.js";
import type { FootageProbe } from "./probe.js";
import { DRAFT_FILTERS, readFfmpegListing } from "./tools.js";

/** A segment's camera (push-in, pull-out, settle, a framing): the schema, the helpers, the draft, the picture and the render. */

const film: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "en",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: null,
};

const PUSH: EdlCamera = { from: 1, to: 1.12, ease: "linear" };
const SETTLE: EdlCamera = { from: 1.2, to: 1, ease: "out", seconds: 1, anchor: { x: 0.5, y: 0.3 } };
const TIGHT: EdlCamera = { from: 1.45, to: 1.45, ease: "linear", anchor: { x: 0.4, y: 0.35 } };

const edl: Edl = {
  version: 2,
  film: "street",
  segments: [
    { id: "s1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none", camera: PUSH },
    { id: "s2", clip: "talk", start: 3, end: 5, transition: "cut", motion: "none", camera: TIGHT },
    { id: "s3", clip: "street", start: 0, end: 2, transition: "fade", motion: "none", fadeFrames: 3, camera: SETTLE },
    { id: "s4", clip: "talk", start: 6, end: 7, transition: "fade", motion: "none" },
  ],
};

describe("camera helpers", () => {
  it("anchors at the kit's zoom origin unless the camera names a point", () => {
    expect(getCameraOrigin(undefined)).toEqual({ x: 0.5, y: 0.42 });
    expect(getCameraOrigin(PUSH)).toBe(CAMERA_ORIGIN);
    expect(getCameraOrigin(SETTLE)).toEqual({ x: 0.5, y: 0.3 });
    expect(toTransformOrigin({ x: 0.5, y: 0.42 })).toBe("50% 42%");
    expect(toTransformOrigin({ x: 0.333333, y: 1 })).toBe("33.3333% 100%");
  });

  it("tells a move from a still framing", () => {
    expect(isCameraMoving(undefined)).toBe(false);
    expect(isCameraMoving(TIGHT)).toBe(false);
    expect(isCameraMoving(PUSH)).toBe(true);
    expect(isCameraMoving(SETTLE)).toBe(true);
  });

  it("runs a move over its seconds or the whole segment, never past the segment and never under one frame", () => {
    expect(getCameraMoveFrames(PUSH, 3)).toBe(90);
    expect(getCameraMoveFrames(SETTLE, 3)).toBe(30);
    expect(getCameraMoveFrames(SETTLE, 0.5)).toBe(15);
    expect(getCameraMoveFrames({ ...PUSH, seconds: 0.001 }, 2)).toBe(1);
    expect(getCameraMoveFrames(PUSH, 0)).toBe(1);
    expect(getCameraMoveSeconds(SETTLE, 3)).toBe(1);
    expect(getCameraMoveSeconds(PUSH, 2.71)).toBe(2.7);
  });

  it("eases linear moves with none and out moves with power1.out, the draft's expression matching", () => {
    expect(getCameraGsapEase("linear")).toBe("none");
    expect(getCameraGsapEase("out")).toBe("power1.out");
    expect(getCameraScaleExpression(PUSH, 90)).toBe("1+(0.12)*min(on/90,1)");
    expect(getCameraScaleExpression(SETTLE, 30)).toBe("1.2+(-0.2)*(1-pow(1-min(on/30,1),2))");
    expect(getCameraScaleExpression(TIGHT, 30, "n")).toBe("1.45");
    expect([0, 45, 90, 120].map((frame) => getCameraScaleAt(PUSH, 90, frame))).toEqual([1, 1.06, 1.12, 1.12]);
    // power1.out: three quarters of the way at half time.
    expect([0, 15, 30, -5].map((frame) => getCameraScaleAt(SETTLE, 30, frame))).toEqual([1.2, 1.05, 1, 1.2]);
  });

  it("compares cameras by every field, the anchor by its point", () => {
    expect(isSameCamera(undefined, undefined)).toBe(true);
    expect(isSameCamera(PUSH, undefined)).toBe(false);
    expect(isSameCamera(undefined, PUSH)).toBe(false);
    expect(isSameCamera(undefined, { from: 1, to: 1, ease: "out", anchor: { x: 0.2, y: 0.2 } })).toBe(true);
    expect(isSameCamera({ from: 1, to: 1, ease: "linear" }, TIGHT)).toBe(false);
    expect(isSameCamera(PUSH, { ...PUSH, anchor: { x: 0.5, y: 0.42 } })).toBe(true);
    expect(isSameCamera(PUSH, { ...PUSH, to: 1.1 })).toBe(false);
    expect(isSameCamera(PUSH, { ...PUSH, ease: "out" })).toBe(false);
    expect(isSameCamera(PUSH, { ...PUSH, seconds: 2 })).toBe(false);
    expect(isSameCamera(SETTLE, { ...SETTLE, anchor: { x: 0.5, y: 0.31 } })).toBe(false);
    expect(isSameCamera(PUSH, { ...PUSH, from: 1.01 })).toBe(false);
  });

  it("describes a camera in a few words", () => {
    expect(describeCamera(undefined)).toBe("none");
    expect(describeCamera(PUSH)).toBe("push 1 → 1.12 linear");
    expect(describeCamera(SETTLE)).toBe("pull 1.2 → 1 out over 1 s at 0.5,0.3");
    expect(describeCamera(TIGHT)).toBe("framing 1.45 at 0.4,0.35");
  });
});

describe("the EDL's camera and fade length", () => {
  const read = (segment: Record<string, unknown>) => readEdl({ version: 2, film: "street", segments: [{ id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none", ...segment }] });

  it("reads a camera and a fade length", () => {
    expect(read({ camera: SETTLE })).toMatchObject({ ok: true });
    expect(read({ transition: "fade", fadeFrames: 3 })).toMatchObject({ ok: true });
  });

  it("refuses a scale outside 1 to the cap, an unknown ease, an anchor off the frame and a fade length out of range", () => {
    expect(MAX_CAMERA_SCALE).toBe(1.6);
    expect(read({ camera: { ...PUSH, to: 1.61 } })).toMatchObject({ ok: false });
    expect(read({ camera: { ...PUSH, from: 0.9 } })).toMatchObject({ ok: false });
    expect(read({ camera: { ...PUSH, ease: "bounce" } })).toMatchObject({ ok: false });
    expect(read({ camera: { ...PUSH, anchor: { x: 1.2, y: 0.5 } } })).toMatchObject({ ok: false });
    expect(read({ camera: { ...PUSH, seconds: 0 } })).toMatchObject({ ok: false });
    expect(read({ camera: { ...PUSH, wobble: 1 } })).toMatchObject({ ok: false });
    expect(read({ transition: "fade", fadeFrames: 0 })).toMatchObject({ ok: false });
    expect(read({ transition: "fade", fadeFrames: 31 })).toMatchObject({ ok: false });
    expect(read({ transition: "fade", fadeFrames: 2.5 })).toMatchObject({ ok: false });
  });

  it("refuses a camera beside the film's own zoom and a fade length on another cut", () => {
    const clips = [
      { id: "talk", duration: 10 },
      { id: "street", duration: 10 },
    ];
    const withSegment = (segment: Partial<EdlSegment>): Edl => ({ ...edl, segments: [{ ...(edl.segments[0] as EdlSegment), ...segment }] });
    expect(validateEdl(edl, clips, "street")).toEqual([]);
    expect(validateEdl(withSegment({ motion: "kenburns" }), clips, "street")).toEqual([
      "segments[0].camera: the segment has a Ken Burns zoom, which owns the picture's scale; set motion to none or drop the camera",
    ]);
    expect(validateEdl(withSegment({ transition: "zoom" }), clips, "street")).toEqual(["segments[0].camera: the segment starts on a zoom cut, which owns the picture's scale; start it on a cut or a fade"]);
    expect(validateEdl(withSegment({ fadeFrames: 3 }), clips, "street")).toEqual(["segments[0].fadeFrames: only a fade cut has a length; this segment starts on a cut"]);
  });

  it("names a camera and a fade length change in the diff", () => {
    const after: Edl = {
      ...edl,
      segments: edl.segments.map((segment, index) => {
        if (index === 0) return { ...segment, camera: SETTLE };
        if (index === 2) return { ...segment, fadeFrames: 5 };
        if (index === 3) return { ...segment, camera: TIGHT, fadeFrames: 4 };
        return segment;
      }),
    };
    expect(diffEdl(edl, after)).toEqual([
      "s1: camera push 1 → 1.12 linear → pull 1.2 → 1 out over 1 s at 0.5,0.3",
      "s3: fade 3 frames → 5 frames",
      "s4: camera none → framing 1.45 at 0.4,0.35",
      "s4: fade default → 4 frames",
    ]);
    expect(diffEdl(after, edl)).toContain("s3: fade 5 frames → 3 frames");
    expect(diffEdl(after, edl)).toContain("s4: fade 4 frames → default");
  });
});

describe("scales and fades with a camera", () => {
  it("starts a camera segment at its camera's from, never eases a zoom cut into it", () => {
    expect(getSegmentScales(edl)).toEqual([1, 1.45, 1.2, 1]);
    const zoomed: Edl = { ...edl, segments: [...edl.segments, { id: "s5", clip: "talk", start: 8, end: 9, transition: "zoom", motion: "none" }] };
    expect(getSegmentScales(zoomed, 110)).toEqual([1, 1.45, 1.2, 1, 1.1]);
    expect(getSegmentZoomEases({ ...edl, segments: [edl.segments[0] as EdlSegment, { ...(edl.segments[1] as EdlSegment), transition: "zoom" }] }, { zoomPercent: 110, zoomEaseFrames: 4 })).toEqual([0, 0]);
  });

  it("fades over a segment's own length, the film's without one, and never on the first segment or a plain cut", () => {
    expect(edl.segments.map((_segment, index) => getSegmentFadeFrames(edl, index, DEFAULT_EDIT))).toEqual([0, 0, 3, 10]);
    expect(getSegmentFadeFrames({ segments: [{ ...(edl.segments[2] as EdlSegment) }] }, 0, DEFAULT_EDIT)).toBe(0);
    expect(getSegmentFadeFrames(edl, 9, DEFAULT_EDIT)).toBe(0);
  });
});

describe("the draft with a camera", () => {
  const plans = planFootageDraft(film, edl);

  function argsInput(changes: Partial<FootageDraftArgsInput> = {}): FootageDraftArgsInput {
    return { film, edl, clips: { talk: "/clips/talk.mp4", street: "/clips/street.mp4" }, speech: "/s.mp3", frame: LAYOUTS["9:16"].frame, captions: null, fontsDir: null, output: "/out.mp4", ...changes };
  }

  function getGraph(args: string[]): string[] {
    return (args[args.indexOf("-filter_complex") + 1] as string).split(";");
  }

  it("plans each camera's scales, frames, origin and the segment's own fade", () => {
    expect(plans.map((plan) => [plan.scale, plan.endScale, plan.camera?.frames ?? null, plan.origin])).toEqual([
      [1, 1.12, 90, { x: 0.5, y: 0.42 }],
      [1.45, 1.45, 60, { x: 0.4, y: 0.35 }],
      [1.2, 1, 30, { x: 0.5, y: 0.3 }],
      [1, 1, null, { x: 0.5, y: 0.42 }],
    ]);
    expect(plans.map((plan) => plan.fade)).toEqual([0, 0, 0.1, 0.333]);
    expect(plans.map((plan) => plan.seconds)).toEqual([3, 2.1, 2.333, 1]);
  });

  it("zooms a move with zoompan about its anchor, crops a still framing about its anchor", () => {
    const graph = getGraph(buildFootageDraftArgs(argsInput()));
    expect(graph[0]).toContain("[0:v]setpts=PTS-STARTPTS,zoompan=z='1+(0.12)*min(on/90,1)':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.42':d=1:s=540x960:fps=30,setsar=1");
    expect(graph[1]).toContain("[1:v]setpts=PTS-STARTPTS,crop=iw/1.45:ih/1.45:(iw-iw/1.45)*0.4:(ih-ih/1.45)*0.35,scale=540:960,setsar=1");
    expect(graph[2]).toContain("[2:v]setpts=PTS-STARTPTS,zoompan=z='1.2+(-0.2)*(1-pow(1-min(on/30,1),2))':x='(iw-iw/zoom)*0.5':y='(ih-ih/zoom)*0.3'");
    expect(graph[3]).toContain("[3:v]setpts=PTS-STARTPTS,scale=540:960,setsar=1");
    expect(graph).toContain("[j1][v2]xfade=transition=fade:duration=0.1:offset=5[j2]");
    expect(graph).toContain("[j2][v3]xfade=transition=fade:duration=0.333:offset=7[j3]");
  });
});

describe("the render with a camera", () => {
  function input(changes: Partial<FootageComposeInput> = {}): FootageComposeInput {
    return {
      film,
      edl,
      words: [],
      frame: LAYOUTS["9:16"].frame,
      caption: LAYOUTS["9:16"].caption,
      headlineSize: 96,
      colors: {
        background: "#0c0c0d",
        foreground: "#f2f3f5",
        muted: "#a3a6ad",
        accent: "#cff26b",
        cta: "#2dd4bf",
        onCta: "#0c0c0d",
        captionBackground: "#ecf1f7",
        captionText: "#0c0c0d",
        captionHighlight: "#059669",
      },
      fonts: { heading: null, body: null },
      assets: { clips: { talk: "clips/talk.mp4", street: "clips/street.mp4" }, speech: "s.mp3", music: null, lastFrame: "last.jpg", logo: null, sfx: {} },
      brandName: "Acme",
      locale: "en-US",
      ...changes,
    };
  }

  it("tweens each move with its ease and length from its scale, and anchors each video at its camera", () => {
    const html = composeFootage(input());
    expect(html).toContain('<video id="seg0" class="clip shot" src="clips/talk.mp4" data-start="0" data-media-start="0" data-duration="3" style="transform:scale(1);transform-origin:50% 42%" muted playsinline></video>');
    expect(html).toContain('<video id="seg1" class="clip shot" src="clips/talk.mp4" data-start="3" data-media-start="3" data-duration="2.1" style="transform:scale(1.45);transform-origin:40% 35%" muted playsinline></video>');
    expect(html).toContain('<video id="seg3" class="clip shot" src="clips/talk.mp4" data-start="7" data-media-start="6" data-duration="1" muted playsinline></video>');
    expect(html).toContain('tl.fromTo("#seg0", { scale: 1 }, { scale: 1.12, duration: 3, ease: "none", immediateRender: false }, 0);');
    expect(html).toContain('tl.fromTo("#seg2", { scale: 1.2 }, { scale: 1, duration: 1, ease: "power1.out", immediateRender: false }, 5);');
    expect(html).not.toContain('tl.fromTo("#seg1", { scale: 1.45 }');
    expect(html).toContain('tl.fromTo("#seg2", { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, 5);');
    expect(html).toContain('tl.fromTo("#seg3", { opacity: 0 }, { opacity: 1, duration: 0.333, ease: "none", immediateRender: false }, 7);');
  });

  it("sets the one picture's scale and anchor at every segment when the film has a camera", () => {
    const html = composeFootage(input({ assets: { ...input().assets, picture: "picture.mp4" } }));
    expect(html).toContain('tl.set("#picture", { scale: 1, transformOrigin: "50% 42%" }, 0);');
    expect(html).toContain('tl.set("#picture", { scale: 1.45, transformOrigin: "40% 35%" }, 3);');
    expect(html).toContain('tl.set("#picture", { scale: 1, transformOrigin: "50% 42%" }, 7);');
    expect(html).toContain('tl.fromTo("#picture", { scale: 1.2 }, { scale: 1, duration: 1, ease: "power1.out", immediateRender: false }, 5);');
  });

  it("keeps the picture's markup of a film without a camera", () => {
    const still: Edl = { ...edl, segments: edl.segments.map((segment) => ({ ...segment, camera: undefined })) };
    const html = composeFootage(input({ edl: still, assets: { ...input().assets, picture: "picture.mp4" } }));
    expect(html).toContain('tl.set("#picture", { scale: 1 }, 0);');
    expect(html).not.toContain("transformOrigin");
  });
});

describe("the picture with a camera", () => {
  it("holds a camera's tail at the zoom it reached, relative to the incoming camera's start, about its anchor", () => {
    const pieces = planFootagePicture(film, edl);
    // Out of the tight framing (1.45) into the settle starting at 1.2: what is left is 1.45 / 1.2.
    expect(pieces[2]?.fade).toEqual({ clip: "talk", start: 5, frames: 3, scale: 1.2083, origin: { x: 0.4, y: 0.35 } });
    // Out of the settle (ends at 1) into a segment without a camera at 1.
    expect(pieces[3]?.fade).toEqual({ clip: "street", start: 2, frames: 10, scale: 1, origin: { x: 0.5, y: 0.3 } });
    const args = buildPicturePieceArgs({ piece: pieces[2] as NonNullable<(typeof pieces)[number]>, clips: { talk: "/t.mp4", street: "/s.mp4" }, frame: LAYOUTS["9:16"].frame, output: "/p.mp4" });
    expect(args[args.indexOf("-filter_complex") + 1]).toContain("[1:v]crop=iw/1.2083:ih/1.2083:(iw-iw/1.2083)*0.4:(ih-ih/1.2083)*0.35,scale=1080:1920,");
  });

  it("never bakes a tail below the full frame when the incoming camera starts tighter", () => {
    const tighter: Edl = { ...edl, segments: [edl.segments[0] as EdlSegment, { ...(edl.segments[1] as EdlSegment), transition: "fade" }] };
    expect(planFootagePicture(film, tighter)[1]?.fade).toMatchObject({ scale: 1, origin: { x: 0.5, y: 0.42 } });
  });
});

describe("overlays across a camera", () => {
  const WORDS = [
    { text: "We", start: 0.2, end: 0.4 },
    { text: "went", start: 3.5, end: 3.8 },
  ];
  const frame = LAYOUTS["9:16"].frame;
  const caption = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };

  it("ends a shot at a move or a new framing, not between two pieces of one still framing", () => {
    expect(findShotBreak(edl, 1)).toBe('a camera move or a new framing at segment "s2"');
    const still: Edl = { ...edl, segments: [{ ...(edl.segments[1] as EdlSegment), id: "a" }, { ...(edl.segments[1] as EdlSegment), id: "b", start: 5, end: 6 }] };
    expect(findShotBreak(still, 1)).toBeNull();
    const moving: Edl = { ...edl, segments: [{ ...(edl.segments[0] as EdlSegment), id: "a" }, { ...(edl.segments[0] as EdlSegment), id: "b", start: 3, end: 4 }] };
    expect(findShotBreak(moving, 1)).toBe('a camera move or a new framing at segment "b"');
  });

  it("refuses a punch-in on a camera segment", () => {
    const result = resolveEdlOverlays({ film, edl: { ...edl, overlays: [{ kind: "punch_in", at: 3.5, duration: 1 }] }, words: WORDS, frame, caption });
    expect(result).toEqual({ ok: false, problems: ['overlays[0]: segment "s2" has a camera (a move or a framing), which owns the picture\'s scale; put the punch-in on a segment without one'] });
  });
});

const ffmpegFilters = (() => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return result.status === 0 ? readFfmpegListing(result.stdout) : new Set<string>();
})();

describe.skipIf(!DRAFT_FILTERS.every((filter) => ffmpegFilters.has(filter)))("a draft with cameras, with ffmpeg", () => {
  let dir = "";
  afterEach(() => {
    if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
  });

  /** The draft's frame at `seconds`, as raw 54x96 grey pixels. */
  function grabFrame(file: string, seconds: number): Buffer {
    const grabbed = spawnSync("ffmpeg", ["-v", "error", "-ss", String(seconds), "-i", file, "-frames:v", "1", "-vf", "scale=54:96", "-pix_fmt", "gray", "-f", "rawvideo", "-"]);
    return grabbed.stdout;
  }

  /** The mean absolute difference of two grey frames, 0 to 255. */
  function diffFrames(a: Buffer, b: Buffer): number {
    let sum = 0;
    for (let index = 0; index < a.length; index++) sum += Math.abs((a[index] ?? 0) - (b[index] ?? 0));
    return sum / a.length;
  }

  it("writes a draft as long as the cut with a push, a framing, a settle and a short fade", async () => {
    dir = mkdtempSync(join(tmpdir(), "footage-camera-"));
    const make = (name: string, source: string): string => {
      const file = join(dir, `${name}.mp4`);
      const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `${source}=s=1080x1920:r=30:d=8`, "-f", "lavfi", "-i", "sine=d=8", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
      if (made.status !== 0) throw new Error(`making the test clip ${name} failed: ${made.stderr.toString()}`);
      return file;
    };
    const talk = make("talk", "testsrc2");
    const street = make("street", "smptebars");
    const probe = {} as FootageProbe;
    const clip = (id: string, file: string, role: "talk" | "broll"): PreparedClip => ({ clip: { id, source: file, role, fit: "auto", trim: { start: 0, end: null }, script: null }, source: file, probe, file, duration: 8 });
    const drafted = await renderFootageDraft(film, [clip("talk", talk, "talk"), clip("street", street, "broll")], { kind: "ready", words: { talk: [], street: [] }, speech: { talk, street } }, edl, {
      buildDir: join(dir, "build"),
      output: join(dir, "draft.mp4"),
      log: () => undefined,
    });
    if (!drafted.ok) throw new Error(drafted.error);
    const probed = spawnSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames:format=duration", "-of", "json", drafted.value.output], { encoding: "utf8" });
    const facts = JSON.parse(probed.stdout) as { streams: { nb_read_frames: string }[]; format: { duration: string } };
    expect(Math.abs(Number(facts.format.duration) - 8)).toBeLessThan(0.05);
    expect(Number(facts.streams[0]?.nb_read_frames)).toBe(240);
    // The settle on the still bars eases from 1.2 to 1 over its first second, then holds.
    const [early, settled, later] = [5.15, 6.4, 6.9].map((at) => grabFrame(drafted.value.output, at)) as [Buffer, Buffer, Buffer];
    expect(early.length).toBe(54 * 96);
    expect(diffFrames(settled, later)).toBeLessThan(1);
    expect(diffFrames(early, settled)).toBeGreaterThan(3);
  }, 120_000);
});
