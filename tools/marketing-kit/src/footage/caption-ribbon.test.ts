import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { getCaptionRibbonTilt, getFootageCaptionChunks, getRibbonCaptionExtent, toCaptionDisplayText } from "./captions.js";
import { composeFootage, getRibbonCaptionCss, type FootageComposeInput } from "./compose.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { createDraftTextMeasure } from "./draft-text-width.js";
import type { Edl } from "./edl.js";
import { CAPTION_RIBBON, CAPTION_RIBBON_TILT, DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { readFfmpegListing } from "./tools.js";

/** Ribbon captions: bold capitals, each line on its own flat strip, the block slightly turned. */

const film: FootageFilm = {
  id: "trip",
  title: "Trip",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  captionStyle: "ribbon",
  endCard: null,
};

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 10, transition: "cut", motion: "none" }] };

const WORDS = [
  { text: "Trzy", start: 0.5, end: 0.8 },
  { text: "noce", start: 0.85, end: 1.2 },
  { text: "za", start: 1.25, end: 1.4 },
  { text: "czterdzie\u015bci", start: 1.45, end: 2.1 },
  { text: "z\u0142otych.", start: 2.15, end: 2.6 },
  { text: "\u0141\u00f3d\u017a", start: 3.2, end: 3.6 },
  { text: "noc\u0105.", start: 3.65, end: 4 },
];
const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 150, right: 150, fontSize: 64 };
const COLORS = { captionBackground: "#000000b3", captionText: "#ffffff", captionHighlight: "#ffd400" };

function composeInput(changes: Partial<FootageFilm> = {}): FootageComposeInput {
  return {
    film: { ...film, ...changes },
    edl: EDL,
    words: WORDS,
    frame: FRAME,
    caption: CAPTION,
    headlineSize: 96,
    colors: { background: "#0c0c0d", foreground: "#f2f3f5", muted: "#a3a6ad", accent: "#cff26b", cta: "#2dd4bf", onCta: "#0c0c0d", ...COLORS },
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "pl-PL",
  };
}

const measure = createDraftTextMeasure(readFileSync(FOOTAGE_DRAFT_FONT.file));

function draft(changes: Partial<FootageFilm> = {}): string {
  return buildFootageDraftCaptions({ film: { ...film, ...changes }, edl: EDL, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS, locale: "pl-PL", ...(measure === null ? {} : { measure }) }) ?? "";
}

describe("the ribbon caption's settings", () => {
  it("turns by the kit's four degrees unless the film names its own", () => {
    expect(CAPTION_RIBBON_TILT).toBe(4);
    expect(getCaptionRibbonTilt({})).toBe(4);
    expect(getCaptionRibbonTilt({ captionRibbonTilt: -3 })).toBe(-3);
    expect(getCaptionRibbonTilt({ captionRibbonTilt: 0 })).toBe(0);
  });

  it("cuts its cards like the highlight pill, four words by default", () => {
    const ribbon = getFootageCaptionChunks({ ...film, captionKeepWithNext: [] }, WORDS).map((chunk) => chunk.words.map((word) => word.text).join(" "));
    const pill = getFootageCaptionChunks({ ...film, captionStyle: "highlight", captionKeepWithNext: [] }, WORDS).map((chunk) => chunk.words.map((word) => word.text).join(" "));
    expect(ribbon).toEqual(pill);
    expect(ribbon).toEqual(["Trzy noce za czterdzie\u015bci", "z\u0142otych.", "\u0141\u00f3d\u017a noc\u0105."]);
  });

  it("shows a ribbon's words in capitals of the locale and every other style's as said", () => {
    expect(toCaptionDisplayText({ captionStyle: "ribbon" }, "\u0142\u00f3d\u017a noc\u0105", "pl-PL")).toBe("\u0141\u00d3D\u0179 NOC\u0104");
    expect(toCaptionDisplayText({ captionStyle: "ribbon" }, "istanbul", "tr-TR")).toBe("\u0130STANBUL");
    expect(toCaptionDisplayText({ captionStyle: "highlight" }, "\u0142\u00f3d\u017a", "pl-PL")).toBe("\u0142\u00f3d\u017a");
    expect(toCaptionDisplayText({}, "\u0142\u00f3d\u017a", "pl-PL")).toBe("\u0142\u00f3d\u017a");
  });
});

describe("how far a turned ribbon reaches", () => {
  it("reaches only its own height above its foot when it is not turned", () => {
    expect(getRibbonCaptionExtent({ fontSize: 58, tilt: 0, width: 780, lines: 2 })).toEqual({ above: Math.ceil(2 * CAPTION_RIBBON.lineHeight * 58), below: 0 });
  });

  it("dips below its foot and rises above its top by half its width's rise, either way it turns", () => {
    const height = 2 * CAPTION_RIBBON.lineHeight * 58;
    const radians = (4 * Math.PI) / 180;
    const reach = 390 * Math.sin(radians) + (height / 2) * (Math.cos(radians) - 1);
    const expected = { above: Math.ceil(height + reach), below: Math.ceil(reach) };
    expect(getRibbonCaptionExtent({ fontSize: 58, tilt: 4, width: 780, lines: 2 })).toEqual(expected);
    expect(getRibbonCaptionExtent({ fontSize: 58, tilt: -4, width: 780, lines: 2 })).toEqual(expected);
    expect(expected.below).toBe(28);
  });
});

describe("the render's ribbon", () => {
  it("writes each card as one strip span in capitals, in a turned caption box", () => {
    const html = composeFootage(composeInput());
    expect(html).toContain('<div id="cap0" class="clip caption turned" data-start="0.45"');
    expect(html).toContain('<p class="ribbon"><span class="rb">TRZY NOCE ZA CZTERDZIE\u015aCI</span></p>');
    expect(html).toContain('<p class="ribbon"><span class="rb">\u0141\u00d3D\u0179 NOC\u0104.</span></p>');
    expect(html).not.toContain('class="pill"');
    expect(html).toContain(".caption.turned{transform:rotate(-4deg);transform-origin:50% 50%}");
  });

  it("draws the strips in the caption background and the capitals in the caption text colour", () => {
    expect(getRibbonCaptionCss(58, 4, { background: "#000000b3", text: "#ffffff" }).split("\n")).toEqual([
      ".caption.turned{transform:rotate(-4deg);transform-origin:50% 50%}",
      ".ribbon{font-weight:800;font-size:58px;line-height:1.42;letter-spacing:.01em;text-align:center;color:#ffffff}",
      ".rb{background:#000000b3;padding:0.1em 0.32em;border-radius:6px;-webkit-box-decoration-break:clone;box-decoration-break:clone}",
    ]);
    expect(getRibbonCaptionCss(58, -3, { background: "#111111", text: "#eeeeee" })).toContain("rotate(3deg)");
  });

  it("lets each card enter by the film's entrance, a rise without one, and lights no word", () => {
    const html = composeFootage(composeInput());
    // The card's start is its one time: the entrance runs off it, and no word is lit.
    expect(html).toContain("const captions = [[0.5],[2.15],[3.2]];");
    expect(html).toContain('tl.fromTo("#cap" + i + " .ribbon", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: "power3.out" }, Math.max(0, words[0] - 0.05));');
    expect(html).not.toContain("words.forEach");
    expect(composeFootage(composeInput({ captionEntrance: "fade" }))).toContain('tl.fromTo("#cap" + i + " .ribbon", { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "power1.out" }');
    expect(composeFootage(composeInput({ captionEntrance: "none" }))).not.toContain(".ribbon\", ");
  });

  it("writes the other styles exactly as before", () => {
    for (const captionStyle of ["phrase", "highlight"] as const) {
      const html = composeFootage(composeInput({ captionStyle }));
      expect(html).not.toContain("ribbon");
      expect(html).not.toContain("turned");
      expect(html).not.toContain("TRZY");
    }
  });
});

describe("the draft's ribbon", () => {
  const lines = (ass: string): string[] => ass.split("\n").filter((line) => line.startsWith("Dialogue:"));

  it("draws one flat strip and one centred line of capitals per line, all turned about the block's middle", () => {
    const events = lines(draft());
    const first = events.filter((line) => line.startsWith("Dialogue: 0,0:00:00.45") || line.startsWith("Dialogue: 1,0:00:00.45"));
    // "TRZY NOCE ZA CZTERDZIE\u015aCI" breaks into two lines in a 780 px box at 64 px: two strips, two text lines.
    expect(first.filter((line) => line.includes("\\p1"))).toHaveLength(2);
    const texts = first.filter((line) => line.startsWith("Dialogue: 1,"));
    expect(texts.map((line) => line.replace(/^.*\}/, ""))).toEqual(["TRZY NOCE ZA", "CZTERDZIE\u015aCI"]);
    const step = CAPTION_RIBBON.lineHeight * 64;
    const blockTop = 1920 - 420 - 2 * step;
    const turn = `\\org(540,${String(Math.round(blockTop + step))})\\frz4`;
    for (const line of first) expect(line).toContain(turn);
    expect(texts[0]).toContain(`\\an8\\pos(540,${String(Math.round(blockTop + (step - 64) / 2))})`);
    expect(texts[1]).toContain(`\\an8\\pos(540,${String(Math.round(blockTop + step + (step - 64) / 2))})`);
    expect(texts[0]).toContain("\\b1\\1c&HFFFFFF&\\1a&H00&\\bord0\\shad0}");
  });

  it("draws the strips in the caption background with its opacity and no shadow or border", () => {
    const strips = lines(draft()).filter((line) => line.includes("\\p1"));
    expect(strips.length).toBeGreaterThan(0);
    for (const strip of strips) {
      expect(strip).toContain("\\1c&H000000&\\1a&H4C&\\bord0\\shad0");
      expect(strip).not.toContain("\\blur");
    }
  });

  it("sizes each strip to its line's capitals plus the padding, centred on the box's axis", () => {
    if (measure === null) throw new Error("the draft font must be measurable");
    const strip = lines(draft()).find((line) => line.includes("\\p1") && line.includes("0:00:03.15")) ?? "";
    const width = measure("\u0141\u00d3D\u0179 NOC\u0104.", 64) + 2 * CAPTION_RIBBON.padding.x * 64;
    const left = Math.round(540 - width / 2);
    // The rounded strip's outline starts its corner's radius right of its left edge.
    expect(strip).toMatch(new RegExp(`\\\\p1\\}m ${String(left + CAPTION_RIBBON.radius)} `));
    expect(strip).toContain(` l ${String(left)} `);
  });

  it("hangs the block from the box's top when the box has no foot, and turns by the film's own tilt", () => {
    const ass = buildFootageDraftCaptions({ film: { ...film, captionRibbonTilt: -3 }, edl: EDL, words: WORDS.slice(5), caption: { top: 600, left: 150, right: 150, fontSize: 64 }, frame: FRAME, colors: COLORS, locale: "pl-PL" }) ?? "";
    const text = lines(ass).find((line) => line.startsWith("Dialogue: 1,")) ?? "";
    const step = CAPTION_RIBBON.lineHeight * 64;
    expect(text).toContain(`\\an8\\pos(540,${String(Math.round(600 + (step - 64) / 2))})`);
    expect(text).toContain(`\\org(540,${String(Math.round(600 + step / 2))})\\frz-3`);
    expect(text.replace(/^.*\}/, "")).toBe("\u0141\u00d3D\u0179 NOC\u0104.");
  });

  it("names the shape style and no Caption dialogue, and draws the other styles as before", () => {
    const ass = draft();
    expect(ass).toContain("Style: CaptionShape,DejaVu Sans,64,");
    expect(lines(ass).some((line) => line.includes(",Caption,"))).toBe(false);
    expect(draft({ captionStyle: "phrase" })).not.toContain("CaptionShape");
    expect(draft({ captionStyle: "phrase" })).not.toContain("TRZY");
  });

  it("writes nothing without captions", () => {
    expect(draft({ captions: false })).toBe("");
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the ribbon burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grabFrame(ass: string, seconds: number): Buffer {
    dir = mkdtempSync(join(tmpdir(), "ribbon-"));
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"));
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${String(FRAME.width)}x${String(FRAME.height)}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  const pixel = (frame: Buffer, x: number, y: number): number[] => {
    const at = (Math.round(y) * FRAME.width + Math.round(x)) * 3;
    return [frame[at] ?? 0, frame[at + 1] ?? 0, frame[at + 2] ?? 0];
  };
  /** The rows holding white letters, top and bottom. */
  const findTextRows = (frame: Buffer): { top: number; bottom: number } => {
    let top = FRAME.height;
    let bottom = -1;
    for (let y = 0; y < FRAME.height; y += 1) {
      for (let x = 0; x < FRAME.width; x += 2) {
        const [r, g, b] = pixel(frame, x, y);
        if ((r ?? 0) > 235 && (g ?? 0) > 235 && (b ?? 0) > 235) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          break;
        }
      }
    }
    return { top, bottom };
  };
  /** The white letters' leftmost column in rows `from` to `to`. */
  const findLeftmost = (frame: Buffer, from: number, to: number): number => {
    let left = FRAME.width;
    for (let y = from; y <= to; y += 1) {
      for (let x = 0; x < FRAME.width; x += 1) {
        const [r, g, b] = pixel(frame, x, y);
        if ((r ?? 0) > 235 && (g ?? 0) > 235 && (b ?? 0) > 235) {
          left = Math.min(left, x);
          break;
        }
      }
    }
    return left;
  };

  it("darkens the background under the strips and leaves it as it was beside them", () => {
    const frame = grabFrame(draft(), 3.4);
    const rows = findTextRows(frame);
    expect(rows.bottom).toBeGreaterThan(rows.top);
    const middle = (rows.top + rows.bottom) / 2;
    // 70 % black over #3366aa: the strip's colour fills most of the row through the letters' middle.
    let strip = 0;
    for (let x = 0; x < FRAME.width; x += 1) {
      const [r, g, b] = pixel(frame, x, middle);
      if (Math.abs((r ?? 0) - 15) < 12 && Math.abs((g ?? 0) - 31) < 12 && Math.abs((b ?? 0) - 51) < 14) strip += 1;
    }
    expect(strip).toBeGreaterThan(150);
    // Beside the strips the background stays as it was (within the colour conversion's rounding).
    pixel(frame, 160, middle).forEach((channel, index) => expect(Math.abs(channel - ([0x33, 0x66, 0xaa][index] ?? 0))).toBeLessThan(5));
  });

  it("turns the block: the line's left end sits lower than its right end", () => {
    const frame = grabFrame(draft(), 3.4);
    const rows = findTextRows(frame);
    const height = rows.bottom - rows.top;
    // A block turned counter-clockwise rises to the right: the letters' first column is in the lower rows.
    const lower = findLeftmost(frame, rows.top + Math.round(height * 0.6), rows.bottom);
    const upper = findLeftmost(frame, rows.top, rows.top + Math.round(height * 0.3));
    expect(lower).toBeLessThan(upper);
    const flat = grabFrame(draft({ captionRibbonTilt: 0 }), 3.4);
    const flatRows = findTextRows(flat);
    expect(flatRows.bottom - flatRows.top).toBeLessThan(height);
  });
});
