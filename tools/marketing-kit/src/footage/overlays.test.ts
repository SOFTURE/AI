import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "./compose.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftArgs, buildFootageDraftCaptions, planFootageDraft } from "./draft.js";
import { diffEdl, readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import type { EdlOverlay } from "./overlay-schema.js";
import { getOverlaySafeZone, resolveEdlOverlays, type ResolveOverlaysInput, type ResolvedOverlay } from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** EDL overlays (issue #1200): the schema, the guards, the render's composition and the draft. */

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
  captionPreset: "reels",
  endCard: null,
};

const SEGMENTS: Edl["segments"] = [
  { id: "s1", clip: "talk", start: 0, end: 4, transition: "cut", motion: "none" },
  { id: "s2", clip: "talk", start: 5, end: 9, transition: "zoom", motion: "none" },
  { id: "r1", clip: "street", start: 0, end: 3, transition: "cut", motion: "kenburns" },
];

const WORDS = [
  { text: "We", start: 0.2, end: 0.4 },
  { text: "went", start: 0.5, end: 0.8 },
  { text: "to", start: 0.9, end: 1 },
  { text: "Lisbon.", start: 1.1, end: 1.6 },
  { text: "Lisbon", start: 5.2, end: 5.7 },
  { text: "again", start: 5.8, end: 6.2 },
];

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };

function edlWith(overlays: EdlOverlay[]): Edl {
  return { version: 2, film: "street", segments: SEGMENTS, overlays };
}

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: WORDS, frame: FRAME, caption: CAPTION, ...changes });
}

function resolved(overlays: EdlOverlay[]): ResolvedOverlay[] {
  const result = resolve(overlays);
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

describe("the EDL's overlays schema", () => {
  const read = (overlay: Record<string, unknown>) => readEdl({ version: 2, film: "street", segments: SEGMENTS, overlays: [overlay] });

  it("reads every kind with what it needs", () => {
    for (const overlay of [
      { kind: "punch_in", at_word: { text: "Lisbon" }, duration: 1.2, style: { size: "l" } },
      { kind: "keyword", at: 1, duration: 1.5, text: "3x" },
      { kind: "lower_third", at: 1, duration: 2, text: "Lisbon, Portugal", style: { side: "right" } },
      { kind: "list", at: 1, duration: 3, items: ["Cheap", "Sunny"] },
      { kind: "arrow", at: 1, duration: 1.5, anchor: { x: 600, y: 700 } },
      { kind: "highlight", at: 1, duration: 1.5, anchor: { x: 300, y: 500, width: 400, height: 200 } },
    ]) {
      expect(read(overlay).ok, JSON.stringify(overlay)).toBe(true);
    }
  });

  it("refuses an overlay without its parts, with both starts, or too short", () => {
    const error = (overlay: Record<string, unknown>) => {
      const result = read(overlay);
      return result.ok ? "" : result.error;
    };
    expect(error({ kind: "keyword", at: 1, duration: 1.5 })).toBe("overlays.0.text: a keyword needs its text");
    expect(error({ kind: "keyword", at: 1, at_word: { text: "x" }, duration: 1.5, text: "x" })).toBe("overlays.0: needs exactly one of at_word and at");
    expect(error({ kind: "keyword", at: 1, duration: 0.5, text: "x" })).toBe("overlays.0.duration: Too small: expected number to be >=1");
    expect(error({ kind: "list", at: 1, duration: 2, items: ["one"] })).toBe("overlays.0.items: a list needs 2 to 4 points");
    expect(error({ kind: "highlight", at: 1, duration: 2, anchor: { x: 1, y: 1 } })).toBe("overlays.0.anchor: a highlight needs the anchor's width and height");
    expect(error({ kind: "punch_in", at: 1, duration: 2, text: "x" })).toBe("overlays.0.text: a punch_in draws no text; leave it out");
    expect(error({ kind: "keyword", at: 1, duration: 2, text: "x".repeat(25) })).toBe("overlays.0.text: is longer than 24 characters");
  });

  it("names a change of the overlays in the EDL's diff", () => {
    expect(diffEdl(edlWith([]), edlWith([{ kind: "keyword", at: 1, duration: 1.5, text: "3x" }]))).toEqual(["overlays: keyword (was 0)"]);
    expect(diffEdl({ version: 2, film: "street", segments: SEGMENTS }, edlWith([]))).toEqual([]);
  });
});

describe("resolveEdlOverlays", () => {
  it("resolves no overlays to none", () => {
    expect(resolveEdlOverlays({ film, edl: { version: 2, film: "street", segments: SEGMENTS }, words: WORDS, frame: FRAME, caption: CAPTION })).toEqual({ ok: true, overlays: [] });
  });

  it("starts an overlay on its word through the cut, compared without case and punctuation, by occurrence", () => {
    const [first, second] = resolved([
      { kind: "keyword", at_word: { text: "lisbon" }, duration: 1.5, text: "3x" },
      { kind: "punch_in", at_word: { text: "LISBON", occurrence: 2 }, duration: 1 },
    ]);
    expect([first?.start, first?.end, first?.segment]).toEqual([1.1, 2.6, 0]);
    expect(second).toEqual({ index: 1, kind: "punch_in", start: 5.2, end: 6.2, segment: 1, scale: 1.12, ease: 0.35 });
  });

  it("places text overlays inside the safe zone and above the captions", () => {
    const zone = getOverlaySafeZone(film, FRAME);
    const band = { top: 1920 - 420 - Math.ceil(2 * 64 * 1.18 + 32) };
    for (const overlay of resolved([
      { kind: "keyword", at: 0.2, duration: 1, text: "3x" },
      { kind: "lower_third", at: 1.3, duration: 1, text: "Lisbon" },
      { kind: "list", at: 2.5, duration: 1.2, items: ["One", "Two", "Three", "Four"], style: { size: "l" } },
    ])) {
      if (overlay.kind !== "keyword" && overlay.kind !== "lower_third" && overlay.kind !== "list") throw new Error("a text overlay");
      expect(overlay.box.top).toBeGreaterThanOrEqual(zone.top);
      expect(overlay.box.top + overlay.box.height).toBeLessThanOrEqual(band.top - 24);
      expect(overlay.box.left).toBe(zone.left + 24);
      expect(overlay.box.left + overlay.box.width).toBe(1080 - zone.right - 24);
    }
    const [lowerThird] = resolved([{ kind: "lower_third", at: 1.3, duration: 1, text: "Lisbon" }]);
    // The lower third sits right on top of the captions' room.
    expect(lowerThird?.kind === "lower_third" && lowerThird.box.top + lowerThird.box.height).toBe(band.top - 24);
  });

  it("points an arrow from inwards and above its point", () => {
    const [arrow] = resolved([{ kind: "arrow", at: 1, duration: 1.5, anchor: { x: 800, y: 700 } }]);
    expect(arrow).toMatchObject({ kind: "arrow", to: { x: 800, y: 700 }, from: { x: 580, y: 520 } });
  });

  it("refuses with a reason per overlay what the render cannot draw cleanly", () => {
    const problems = (overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}): string[] => {
      const result = resolve(overlays, changes);
      return result.ok ? [] : result.problems;
    };
    expect(problems([{ kind: "keyword", at_word: { text: "Paris" }, duration: 1, text: "x" }])).toEqual(['overlays[0].at_word: no word "Paris" in the cut; the film never says it']);
    expect(problems([{ kind: "keyword", at_word: { text: "Lisbon", occurrence: 3 }, duration: 1, text: "x" }])).toEqual(['overlays[0].at_word: no word "Lisbon" (occurrence 3) in the cut; the film says it 2 times']);
    expect(problems([{ kind: "keyword", at: 10.5, duration: 1, text: "x" }])).toEqual(["overlays[0]: ends at 11.5 s, past the cut's end (11 s)"]);
    expect(problems([{ kind: "keyword", at: 3.5, duration: 1, text: "x" }])).toEqual(['overlays[0]: runs 0.5 s past the cut at 4 s; keep it inside segment "s1" (0-4 s) or shorten it']);
    expect(
      problems([
        { kind: "keyword", at: 1, duration: 2, text: "x" },
        { kind: "lower_third", at: 2, duration: 1.5, text: "y" },
      ]),
    ).toEqual(["overlays[1]: starts at 2 s while overlays[0] is on screen (until 3 s); one overlay at a time"]);
    expect(
      problems(
        [
          { kind: "keyword", at: 0.5, duration: 1, text: "x" },
          { kind: "keyword", at: 5, duration: 1, text: "y" },
        ],
        { film: { ...film, overlayMinSpacing: 8 } },
      ),
    ).toEqual(["overlays[1]: starts 4.5 s after overlays[0]; the film keeps overlays 8 s apart (overlayMinSpacing)"]);
    expect(problems([{ kind: "punch_in", at: 8.5, duration: 1 }])).toEqual(['overlays[0]: segment "r1" has a Ken Burns zoom, which owns the picture\'s scale; put the punch-in on a still segment']);
    expect(problems([{ kind: "punch_in", at: 4, duration: 1 }], { film: { ...film, edit: { zoomEaseFrames: 9 } } })).toEqual([
      'overlays[0]: starts at 4 s, inside the zoom cut\'s ease of segment "s2" (until 4.3 s); start it later',
    ]);
    expect(problems([{ kind: "arrow", at: 1, duration: 1, anchor: { x: 20, y: 700 } }])).toEqual(["overlays[0]: the arrow's point (20, 700) is outside the platform safe zone"]);
    expect(problems([{ kind: "arrow", at: 1, duration: 1, anchor: { x: 500, y: 1400 } }])).toEqual(["overlays[0]: the arrow's point (500, 1400) sits on the captions"]);
    expect(problems([{ kind: "highlight", at: 1, duration: 1, anchor: { x: 300, y: 1200, width: 300, height: 200 } }])).toEqual(["overlays[0]: the highlight overlaps the captions"]);
    expect(problems([{ kind: "highlight", at: 1, duration: 1, anchor: { x: 300, y: 600, width: 30, height: 200 } }])).toEqual(["overlays[0]: the highlight is smaller than 40×40 px"]);
    expect(
      problems([{ kind: "list", at: 1, duration: 2, items: ["One", "Two", "Three", "Four"], style: { size: "l" } }], {
        film: { ...film, format: "16:9" },
        frame: { width: 1080, height: 900 },
        caption: { top: 500, left: 80, right: 80, fontSize: 64 },
      }),
    ).toEqual(["overlays[0]: the list (354 px tall) does not fit between the platform safe zone and the captions; use a smaller size or fewer points"]);
  });
});

const COLORS = {
  background: "#101820",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#ff3d7f",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#059669",
};

function composeInput(overlays?: ResolvedOverlay[]): FootageComposeInput {
  return {
    film,
    edl: edlWith([]),
    words: WORDS,
    frame: FRAME,
    caption: CAPTION,
    headlineSize: 96,
    colors: COLORS,
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4", street: "clips/street.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "en-US",
    ...(overlays === undefined ? {} : { overlays }),
  };
}

const ALL_KINDS: EdlOverlay[] = [
  { kind: "keyword", at: 0.2, duration: 1, text: "3x" },
  { kind: "lower_third", at: 1.3, duration: 1.2, text: "Lisbon, Portugal" },
  { kind: "list", at: 2.6, duration: 1.2, items: ["Cheap", "Sunny"] },
  { kind: "punch_in", at: 4.5, duration: 1.2 },
  { kind: "arrow", at: 5.8, duration: 1, anchor: { x: 800, y: 700 } },
  { kind: "highlight", at: 6.8, duration: 1.2, anchor: { x: 300, y: 500, width: 400, height: 200 } },
];

describe("composeFootage with overlays", () => {
  it("composes a film without overlays as before", () => {
    expect(composeFootage(composeInput([]))).toBe(composeFootage(composeInput()));
    expect(composeFootage(composeInput())).not.toContain("ov-card");
  });

  it("draws every kind as a clip of its own span and zooms the picture for a punch-in", () => {
    const html = composeFootage(composeInput(resolved(ALL_KINDS)));
    expect(html).toContain('<div id="ov0" class="clip ov ov-keyword right" data-start="0.2" data-duration="1"');
    expect(html).toContain('<div id="ov1" class="clip ov ov-lower-third" data-start="1.3" data-duration="1.2"');
    expect(html).toContain('<li id="ov2i1"><i class="ov-dot"></i>Sunny</li>');
    expect(html).toContain('<div id="ov4" class="clip ov ov-arrow" data-start="5.8" data-duration="1" style="inset:0">');
    expect(html).toContain('<rect id="ov5s" x="300" y="500" width="400" height="200"');
    expect(html).not.toContain('id="ov3"');
    expect(html).toContain('tl.fromTo("#picture", { scale: 1.08 }, { scale: 1.21, duration: 0.35, ease: "sine.inOut", immediateRender: false }, 4.5);');
    expect(html).toContain('tl.fromTo("#picture", { scale: 1.21 }, { scale: 1.08, duration: 0.35, ease: "sine.inOut", immediateRender: false }, 5.35);');
    expect(html).toContain(`background:${COLORS.background};color:${COLORS.foreground}`);
    expect(html).toContain(`stroke="${COLORS.accent}"`);
  });

  it("escapes the overlays' text", () => {
    const html = composeFootage(composeInput(resolved([{ kind: "keyword", at: 0.2, duration: 1, text: "<b>&" }])));
    expect(html).toContain('<span id="ov0t">&lt;b&gt;&amp;</span>');
  });
});

describe("the draft's overlays", () => {
  it("writes no overlay styles or events for a film without overlays", () => {
    const base = { film, edl: edlWith([]), words: WORDS, caption: CAPTION, frame: FRAME };
    const ass = buildFootageDraftCaptions(base) ?? "";
    expect(ass).toBe(buildFootageDraftCaptions({ ...base, overlays: [] }));
    expect(ass).not.toContain("Overlay");
  });

  it("draws the overlays on layer 3 in the brand's colours, the same places and times as the render", () => {
    const ass = buildFootageDraftCaptions({ film, edl: edlWith(ALL_KINDS), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(ALL_KINDS), overlayColors: COLORS }) ?? "";
    expect(ass).toContain("Style: Overlay,DejaVu Sans,48,&H00F5F3F2,&H00F5F3F2,&H00201810,&H00201810,-1,0,0,0,100,100,0,0,3,16,0,7,0,0,0,1");
    const events = ass.split("\n").filter((line) => line.startsWith("Dialogue: 3,"));
    expect(events).toHaveLength(5);
    expect(events[0]).toMatch(/^Dialogue: 3,0:00:00\.20,0:00:01\.20,Overlay,,0,0,0,,\{\\an9\\pos\(\d+,\d+\)\\fs84\\bord29\\fad\(150,250\)\}3x$/);
    expect(events[1]).toMatch(/^Dialogue: 3,0:00:01\.30,0:00:02\.50,Overlay,,0,0,0,,\{\\an1\\pos\(\d+,\d+\)\\fs52\\bord18\\fad\(150,250\)\}Lisbon, Portugal$/);
    expect(events[2]).toContain("• Cheap\\N• Sunny");
    expect(events[3]).toMatch(/^Dialogue: 3,0:00:05\.80,0:00:06\.80,OverlayShape,,0,0,0,,\{\\an7\\pos\(0,0\)\\fad\(150,250\)\\p1\}m [\d l]+ m 800 700 l [\d ]+\{\\p0\}$/);
    expect(events[4]).toBe("Dialogue: 3,0:00:06.80,0:00:08.00,OverlayShape,,0,0,0,,{\\an7\\pos(0,0)\\fad(150,250)\\1a&HFF&\\3c&H7F3DFF&\\bord10\\p1}m 305 505 l 695 505 695 695 305 695{\\p0}");
  });

  it("makes a captions file for the overlays of a film without captions", () => {
    const overlays = resolved([{ kind: "keyword", at: 0.2, duration: 1, text: "3x" }]);
    const ass = buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith([]), words: WORDS, caption: CAPTION, frame: FRAME, overlays }) ?? "";
    expect(ass.split("\n").filter((line) => line.startsWith("Dialogue:"))).toHaveLength(1);
  });

  it("zooms a punch-in's segment by its rise, hold and fall", () => {
    const overlays = resolved([{ kind: "punch_in", at: 4.5, duration: 1.2 }]);
    const plans = planFootageDraft(film, edlWith([]), overlays);
    expect(plans.map((plan) => plan.punches)).toEqual([[], [{ from: 15, frames: 36, ease: 11, scale: 1.12 }], []]);
    const args = buildFootageDraftArgs({
      film,
      edl: edlWith([]),
      clips: { talk: "/clips/talk.mp4", street: "/clips/street.mp4" },
      speech: "/draft/speech.mp3",
      frame: FRAME,
      captions: null,
      fontsDir: null,
      output: "/out/draft.mp4",
      overlays,
    });
    const graph = args[args.indexOf("-filter_complex") + 1] ?? "";
    expect(graph).toContain("zoompan=z='(1.08)*(1+0.12*max(0,min(min(1,(on-15)/11),(51-on)/11)))'");
    const without = buildFootageDraftArgs({ film, edl: edlWith([]), clips: { talk: "/t.mp4", street: "/s.mp4" }, speech: "/s.mp3", frame: FRAME, captions: null, fontsDir: null, output: "/o.mp4" });
    expect(without[without.indexOf("-filter_complex") + 1]).not.toContain("max(0,min(min(1");
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the draft's overlays burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grabFrame(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "overlays-")) : dir;
    const ass = buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(overlays), overlayColors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  const pixel = (frame: Buffer, x: number, y: number): number[] => {
    const at = (y * FRAME.width + x) * 3;
    return [frame[at] ?? 0, frame[at + 1] ?? 0, frame[at + 2] ?? 0];
  };
  const isNear = (rgb: number[], hex: string): boolean => [1, 3, 5].every((offset, channel) => Math.abs((rgb[channel] ?? 0) - parseInt(hex.slice(offset, offset + 2), 16)) <= 40);

  it("draws the arrow in the accent up to its point, the highlight round its rectangle and the keyword on its card", () => {
    const arrow = grabFrame([{ kind: "arrow", at: 1, duration: 2, anchor: { x: 800, y: 700 } }], 2);
    // Inside the head, short of the tip at (800, 700), on the travel from (580, 520).
    expect(isNear(pixel(arrow, 776, 681), COLORS.accent)).toBe(true);
    expect(isNear(pixel(arrow, 400, 1200), "#3366aa")).toBe(true);
    const highlight = grabFrame([{ kind: "highlight", at: 1, duration: 2, anchor: { x: 300, y: 500, width: 400, height: 200 } }], 2);
    expect(isNear(pixel(highlight, 500, 500), COLORS.accent)).toBe(true);
    expect(isNear(pixel(highlight, 300, 600), COLORS.accent)).toBe(true);
    expect(isNear(pixel(highlight, 500, 600), "#3366aa")).toBe(true);
    const [keyword] = resolved([{ kind: "keyword", at: 1, duration: 2, text: "3x" }]);
    if (keyword?.kind !== "keyword") throw new Error("a keyword");
    const card = grabFrame([{ kind: "keyword", at: 1, duration: 2, text: "3x" }], 2);
    // The card's right edge stands at the box's right edge; just inside it, the card's colour.
    expect(isNear(pixel(card, keyword.box.left + keyword.box.width - 6, keyword.box.top + 6), COLORS.background)).toBe(true);
    // After the overlay's span, the frame is bare there again.
    const after = grabFrame([{ kind: "keyword", at: 1, duration: 2, text: "3x" }], 4);
    expect(isNear(pixel(after, keyword.box.left + keyword.box.width - 6, keyword.box.top + 6), "#3366aa")).toBe(true);
  });
});
