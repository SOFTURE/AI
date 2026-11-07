import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { CAPTION_HIGHLIGHT_SECONDS, getCaptionHighlight, getCaptionHighlightContrast } from "./caption-highlight.js";
import { composeFootage, type FootageComposeInput } from "./compose.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { readFfmpegListing } from "./tools.js";

/** The lit caption word on its own box (issue #1199): the look, its contrast, the render's composition and the draft. */

const COLORS = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#c2187a",
  captionText: "#ffffff",
  captionHighlight: "#ff8a00",
  captionHighlightBox: "#ff8a00",
  captionHighlightText: "#111111",
};

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
  captionStyle: "highlight",
  captionHighlightStyle: "box",
  endCard: null,
};

const edl: Edl = { version: 2, film: "street", segments: [{ id: "g1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none" }] };

const WORDS = [
  { text: "hello", start: 0.2, end: 0.5 },
  { text: "brave", start: 1, end: 1.4 },
  { text: "world", start: 2, end: 2.4 },
];

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1400, left: 80, right: 80, fontSize: 64 };

describe("getCaptionHighlight", () => {
  it("lights the text in captionHighlight by default and with style text", () => {
    expect(getCaptionHighlight({}, COLORS)).toEqual({ ok: true, look: { style: "text", color: "#ff8a00" } });
    expect(getCaptionHighlight({ captionHighlightStyle: "text" }, { captionHighlight: "#00ff00" })).toEqual({ ok: true, look: { style: "text", color: "#00ff00" } });
  });

  it("puts the word on its box with its own text colour in style box", () => {
    expect(getCaptionHighlight({ captionHighlightStyle: "box" }, COLORS)).toEqual({ ok: true, look: { style: "box", box: "#ff8a00", text: "#111111" } });
  });

  it("refuses style box without both colours, naming the missing ones", () => {
    expect(getCaptionHighlight({ captionHighlightStyle: "box" }, { captionHighlight: "#ff8a00" })).toEqual({
      ok: false,
      error: 'captionHighlightStyle "box" needs the brand colours captionHighlightBox and captionHighlightText (brand.colors or brand.tokensFrom).',
    });
    expect(getCaptionHighlight({ captionHighlightStyle: "box" }, { captionHighlight: "#ff8a00", captionHighlightBox: "#ff8a00" })).toEqual({
      ok: false,
      error: 'captionHighlightStyle "box" needs the brand colours captionHighlightText (brand.colors or brand.tokensFrom).',
    });
  });
});

describe("getCaptionHighlightContrast", () => {
  it("returns the lit text on its box and the box on the pill", () => {
    const contrast = getCaptionHighlightContrast({ captionBackground: "#ffffff", captionHighlightBox: "#000000", captionHighlightText: "#ffffff" });
    expect(contrast).toEqual({ textOnBox: 21, boxOnPill: 21 });
  });

  it("measures a brand's orange box on a magenta pill", () => {
    const contrast = getCaptionHighlightContrast(COLORS);
    expect(contrast?.textOnBox.toFixed(2)).toBe("7.99");
    expect(contrast?.boxOnPill.toFixed(2)).toBe("2.40");
  });

  it("is null without the box colours", () => {
    expect(getCaptionHighlightContrast({ captionBackground: "#ffffff" })).toBeNull();
  });
});

function composeInput(changes: Partial<FootageComposeInput> = {}): FootageComposeInput {
  return {
    film,
    edl,
    words: WORDS,
    frame: FRAME,
    caption: CAPTION,
    headlineSize: 96,
    colors: COLORS,
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "en-US",
    ...changes,
  };
}

describe("composeFootage with a box highlight", () => {
  it("puts a hidden box behind every word, faded in at the word's start and out after the hold", () => {
    const html = composeFootage(composeInput());
    expect(html).toContain('<p class="pill"><span id="cw0_0"><i class="hl" id="cb0_0"></i>hello</span> <span id="cw0_1"><i class="hl" id="cb0_1"></i>brave</span>');
    expect(html).toContain(".hl{position:absolute;top:0;bottom:0;left:-0.15em;right:-0.15em;z-index:-1;border-radius:12px;background:#ff8a00;opacity:0}");
    expect(html).toContain(".pill{position:relative;z-index:0}");
    expect(html).toContain(`tl.fromTo("#cb" + i + "_" + j, { opacity: 0 }, { opacity: 1, duration: 0.06, immediateRender: false }, t).to("#cb" + i + "_" + j, { opacity: 0, duration: 0.2 }, t + ${CAPTION_HIGHLIGHT_SECONDS});`);
    expect(html).toContain('{ color: "#ffffff" }, { color: "#111111", duration: 0.06, immediateRender: false }, t)');
    expect(html).not.toContain('{ color: "#ff8a00"');
  });

  it("draws no box for style text, a phrase film or a film without the style", () => {
    for (const changed of [{ ...film, captionHighlightStyle: "text" as const }, { ...film, captionStyle: "phrase" as const }]) {
      const html = composeFootage(composeInput({ film: changed }));
      expect(html).not.toContain('class="hl"');
      expect(html).not.toContain(".hl{");
    }
    const plain: FootageFilm = { ...film };
    delete plain.captionHighlightStyle;
    expect(composeFootage(composeInput({ film: { ...film, captionHighlightStyle: "text" } }))).toBe(composeFootage(composeInput({ film: plain })));
  });

  it("throws on a box film without its colours (the pipeline refuses it first)", () => {
    const colors: FootageComposeInput["colors"] = { ...COLORS };
    delete colors.captionHighlightBox;
    expect(() => composeFootage(composeInput({ colors }))).toThrow('composeFootage: captionHighlightStyle "box" needs the brand colours captionHighlightBox');
  });
});

describe("buildFootageDraftCaptions with a box highlight", () => {
  const dialogue = (ass: string): string[] => ass.split("\n").filter((line) => line.startsWith("Dialogue:"));

  it("writes the pill, the lit word's box and the text as three layers while a word is lit", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS }) ?? "";
    const lines = dialogue(ass);
    // "brave" is lit from 1.00 to 1.32 s.
    expect(lines.filter((line) => line.includes(",0:00:01.00,0:00:01.32,"))).toEqual([
      "Dialogue: 0,0:00:01.00,0:00:01.32,Caption,,0,0,0,,{\\1a&HFF&}hello brave world",
      "Dialogue: 1,0:00:01.00,0:00:01.32,Caption,,0,0,0,,{\\1a&HFF&\\bord10\\3a&HFF&}hello {\\3c&H008AFF&\\3a&H00&}brave{\\3a&HFF&} world",
      "Dialogue: 2,0:00:01.00,0:00:01.32,Caption,,0,0,0,,{\\3a&HFF&\\4a&HFF&}hello {\\1c&H111111&}brave{\\1c&HFFFFFF&} world",
    ]);
    // Between two lit words only the pill and the text.
    expect(lines.filter((line) => line.includes(",0:00:00.52,0:00:01.00,"))).toEqual([
      "Dialogue: 0,0:00:00.52,0:00:01.00,Caption,,0,0,0,,{\\1a&HFF&}hello brave world",
      "Dialogue: 2,0:00:00.52,0:00:01.00,Caption,,0,0,0,,{\\3a&HFF&\\4a&HFF&}hello brave world",
    ]);
  });

  it("keeps a text highlight's events as they were", () => {
    const ass = buildFootageDraftCaptions({ film: { ...film, captionHighlightStyle: "text" }, edl, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS }) ?? "";
    expect(dialogue(ass)).toContain("Dialogue: 0,0:00:01.00,0:00:01.32,Caption,,0,0,0,,hello {\\1c&H008AFF&}brave{\\1c&HFFFFFF&} world");
    expect(ass).not.toContain("Dialogue: 1,");
  });

  it("draws a box film without a brand in the draft's own box colours", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words: WORDS, caption: CAPTION, frame: FRAME }) ?? "";
    expect(ass).toContain("{\\3c&H00D4FF&\\3a&H00&}brave");
    expect(ass).toContain("{\\1c&H111111&}brave");
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the draft's box highlight burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  /** The frame at `seconds` as RGB rows, the captions burned over a flat blue. */
  function grabFrame(seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "caption-box-")) : dir;
    const ass = buildFootageDraftCaptions({ film, edl, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=3:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  /** The columns (left and right, inclusive) whose pixels are near `rgb` in the caption rows, or null for none. */
  function findColumns(frame: Buffer, rgb: readonly [number, number, number]): { left: number; right: number; count: number } | null {
    let left = FRAME.width;
    let right = -1;
    let count = 0;
    for (let y = CAPTION.top; y < CAPTION.top + 200; y += 1) {
      for (let x = 0; x < FRAME.width; x += 1) {
        const at = (y * FRAME.width + x) * 3;
        const isNear = [0, 1, 2].every((channel) => Math.abs((frame[at + channel] ?? 0) - rgb[channel as 0 | 1 | 2]) <= 6);
        if (!isNear) continue;
        count += 1;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return count === 0 ? null : { left, right, count };
  }

  const BOX = [0xff, 0x8a, 0x00] as const;
  const PILL = [0xc2, 0x18, 0x7a] as const;

  it("draws the box only behind the lit word, inside the pill", () => {
    const lit = grabFrame(1.1);
    const box = findColumns(lit, BOX);
    const pill = findColumns(lit, PILL);
    expect(box).not.toBeNull();
    expect(pill).not.toBeNull();
    if (box === null || pill === null) return;
    // The middle word of three: the box sits well inside the pill, pill colour on both sides of it.
    expect(box.left).toBeGreaterThan(pill.left + 100);
    expect(box.right).toBeLessThan(pill.right - 100);
    expect(box.right - box.left).toBeLessThan((pill.right - pill.left) / 2);
  });

  it("draws no box while no word is lit", () => {
    const unlit = grabFrame(0.8);
    expect(findColumns(unlit, BOX)).toBeNull();
    expect(findColumns(unlit, PILL)).not.toBeNull();
  });
});
