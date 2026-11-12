import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup } from "./overlay-html.js";
import { OVERLAY_KEYWORD_ALIGNS, type EdlOverlay, type OverlayKeywordAlign } from "./overlay-schema.js";
import { estimateTextWidth, getDrawnOverlayCard, getOverlayPadding, resolveEdlOverlays, type OverlayBox, type ResolvedOverlay } from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** RV-159 of an adopting app: a keyword's card on the left, in the middle or on the right (`style.align`). */

const film: FootageFilm = {
  id: "trip",
  title: "Trip",
  format: "9:16",
  language: "en",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: false,
  captionPreset: "reels",
  endCard: null,
};
const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const COLORS = { background: "#1d1a2b", foreground: "#fdf7f2", accent: "#e8336b" };
const STYLE = { cornerRadius: "m", shadow: "none", border: "none", padding: "m" } as const;
const SEGMENTS: Edl["segments"] = [{ id: "s1", clip: "talk", start: 0, end: 20, transition: "cut", motion: "none" }];
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

const KEYWORD: EdlOverlay = { kind: "keyword", at: 2, duration: 2, text: "3 days" };
const aligned = (align: OverlayKeywordAlign, overlay: EdlOverlay = KEYWORD): EdlOverlay => ({ ...overlay, style: { ...overlay.style, align } });

function resolve(overlays: EdlOverlay[]) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: [], frame: FRAME, caption: CAPTION, style: STYLE });
}

function keyword(overlay: EdlOverlay): Extract<ResolvedOverlay, { kind: "keyword" }> {
  const result = resolve([overlay]);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const [first] = result.overlays;
  if (first?.kind !== "keyword") throw new Error("expected a keyword");
  return first;
}

function html(overlay: EdlOverlay): string {
  const result = resolve([overlay]);
  if (!result.ok) throw new Error(result.problems.join("; "));
  return getOverlayMarkup(result.overlays, { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE }).html.join("");
}

function draftTexts(overlay: EdlOverlay): string[] {
  const result = resolve([overlay]);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const ass = buildFootageDraftCaptions({ film, edl: edlWith([overlay]), words: [], caption: CAPTION, frame: FRAME, overlays: result.overlays, overlayColors: COLORS, style: STYLE });
  return (ass ?? "").split("\n").filter((line) => line.startsWith("Dialogue: 4,"));
}

describe("a keyword's align in the schema", () => {
  it("takes left, center and right on a keyword", () => {
    for (const align of OVERLAY_KEYWORD_ALIGNS) expect(readEdl(edlWith([aligned(align)])).ok).toBe(true);
  });

  it("refuses align together with side on a keyword", () => {
    const both = readEdl(edlWith([{ ...KEYWORD, style: { align: "left", side: "right" } }]));
    expect(both.ok ? "" : both.error).toBe("overlays.0.style.align: give a keyword align or side, not both");
  });

  it("refuses right on a title, and align on a kind that takes none", () => {
    const title = readEdl(edlWith([{ kind: "hook_title", at: 0, duration: 2, text: "Visa run", style: { align: "right" } }]));
    expect(title.ok ? "" : title.error).toBe("overlays.0.style.align: a hook_title aligns its lines center or left");
    const third = readEdl(edlWith([{ kind: "lower_third", at: 1, duration: 2, text: "Hanoi", style: { align: "center" } }]));
    expect(third.ok ? "" : third.error).toBe("overlays.0.style.align: only a hook_title, a place_card or a keyword takes align; leave it out");
  });

  it("keeps a title's left align", () => {
    expect(readEdl(edlWith([{ kind: "place_card", at: 0, duration: 2, text: "Hoi An", style: { align: "left" } }])).ok).toBe(true);
  });
});

describe("placing an aligned keyword", () => {
  it("puts the card in the middle of its room on center, on the left on left and on the right on right", () => {
    const centre = keyword(aligned("center"));
    const width = Math.ceil(estimateTextWidth("3 days", centre.fontSize) + 2 * getOverlayPadding(centre).x);
    const { box } = centre;
    expect(centre.isCentred).toBe(true);
    expect(getDrawnOverlayCard(centre)).toEqual({ left: box.left + Math.round((box.width - width) / 2), top: box.top, width, height: box.height });
    const left = keyword(aligned("left"));
    expect(left).toMatchObject({ side: "left" });
    expect(left.isCentred).toBeUndefined();
    expect((getDrawnOverlayCard(left) as OverlayBox).left).toBe(box.left);
    const right = keyword(aligned("right"));
    expect(right).toMatchObject({ side: "right" });
    expect(right.isCentred).toBeUndefined();
    const card = getDrawnOverlayCard(right) as OverlayBox;
    expect(card.left + card.width).toBe(box.left + box.width);
  });

  it("keeps a keyword without align on its side, on the right by default", () => {
    expect(keyword(KEYWORD)).toMatchObject({ side: "right" });
    expect(keyword(KEYWORD).isCentred).toBeUndefined();
    expect(keyword({ ...KEYWORD, style: { side: "left" } })).toMatchObject({ side: "left" });
  });
});

describe("drawing an aligned keyword", () => {
  it("renders a centred keyword in the middle with its text centred, and the others on their sides", () => {
    expect(html(aligned("center"))).toContain('class="clip ov ov-keyword center"');
    expect(html(aligned("right"))).toContain('class="clip ov ov-keyword right"');
    expect(html(aligned("left"))).toContain('class="clip ov ov-keyword"');
    const result = resolve([aligned("center")]);
    if (!result.ok) throw new Error(result.problems.join("; "));
    const css = getOverlayMarkup(result.overlays, { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE }).css.join("");
    expect(css).toContain(".ov-keyword.center .ov-card{justify-content:center;text-align:center}");
  });

  it("drafts a centred keyword's text on the card's axis, and a left or right one against its padding", () => {
    const centre = keyword(aligned("center"));
    const card = getDrawnOverlayCard(centre) as OverlayBox;
    const pad = getOverlayPadding(centre);
    expect(draftTexts(aligned("center"))[0]).toContain(`\\an8\\fs${centre.fontSize}\\pos(${Math.round(card.left + card.width / 2)},${card.top + pad.y})`);
    expect(draftTexts(aligned("left"))[0]).toContain(`\\an7\\fs${centre.fontSize}`);
    expect(draftTexts(aligned("right"))[0]).toContain(`\\an9\\fs${centre.fontSize}`);
  });

  it("types a centred keyword in from its middle, showing only what is typed", () => {
    const typed = draftTexts(aligned("center", { ...KEYWORD, style: { entrance: "type" } }));
    expect(typed.length).toBe([..."3 days"].length);
    expect(typed[0]?.endsWith("}3")).toBe(true);
    expect(typed.every((line) => line.includes("\\an8"))).toBe(true);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("an aligned keyword burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grab(overlay: EdlOverlay, seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "keyword-")) : dir;
    const result = resolve([overlay]);
    if (!result.ok) throw new Error(result.problems.join("; "));
    const ass = buildFootageDraftCaptions({ film, edl: edlWith([overlay]), words: [], caption: CAPTION, frame: FRAME, overlays: result.overlays, overlayColors: COLORS, style: STYLE });
    writeFileSync(join(dir, "o.ass"), ass ?? "");
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=o.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  function isNear(frame: Buffer, x: number, y: number, hex: string): boolean {
    const at = (y * FRAME.width + x) * 3;
    return [1, 3, 5].every((offset, channel) => Math.abs((frame[at + channel] ?? 0) - parseInt(hex.slice(offset, offset + 2), 16)) <= 40);
  }

  /** The first and last columns of a row drawn in the card's colour. */
  function getCardSpan(frame: Buffer, y: number): { left: number; right: number } | null {
    const xs = Array.from({ length: FRAME.width }, (_x, x) => x).filter((x) => isNear(frame, x, y, COLORS.background));
    return xs.length === 0 ? null : { left: xs[0] as number, right: xs[xs.length - 1] as number };
  }

  /** The middle of a row's text pixels. */
  function getTextMiddle(frame: Buffer, card: OverlayBox): number {
    const xs: number[] = [];
    for (let y = card.top; y < card.top + card.height; y++) for (let x = card.left; x < card.left + card.width; x++) if (isNear(frame, x, y, COLORS.foreground)) xs.push(x);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  }

  it.each(OVERLAY_KEYWORD_ALIGNS)("draws a %s keyword's card where it reports, its text inside", (align) => {
    const overlay = aligned(align);
    const resolved = keyword(overlay);
    const card = getDrawnOverlayCard(resolved) as OverlayBox;
    const frame = grab(overlay, 3);
    const span = getCardSpan(frame, card.top + Math.round(card.height / 2)) as { left: number; right: number };
    expect(Math.abs(span.left - card.left)).toBeLessThanOrEqual(FRAME.width * 0.02);
    expect(Math.abs(span.right - (card.left + card.width))).toBeLessThanOrEqual(FRAME.width * 0.02);
    expect(Math.abs(getTextMiddle(frame, card) - (card.left + card.width / 2))).toBeLessThanOrEqual(FRAME.width * 0.02);
    const middle = resolved.box.left + resolved.box.width / 2;
    const cardMiddle = (span.left + span.right) / 2;
    if (align === "center") expect(Math.abs(cardMiddle - middle)).toBeLessThanOrEqual(FRAME.width * 0.02);
    if (align === "left") expect(cardMiddle).toBeLessThan(middle);
    if (align === "right") expect(cardMiddle).toBeGreaterThan(middle);
  });
});
