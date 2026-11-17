import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { buildFootageDraftCaptions, FOOTAGE_DRAFT_FONT, fitDraftCaptionPlace, loadFootageDraftFonts } from "./draft.js";
import { createDraftFont, getDraftLineShift, getDraftMiddleShift, type DraftTextMeasure } from "./draft-text-width.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { HAND_FONT } from "./hand-font.js";

/** RV-198 of an adopting app: the draft sets each line on the render's baseline and fits captions as the render does. */

const DEJAVU = readFileSync(FOOTAGE_DRAFT_FONT.file);
const CAVEAT = readFileSync(HAND_FONT.file);
/** One px per character at every size, so a test reads the widths off the text. */
const PER_CHARACTER: DraftTextMeasure = (text, fontSize) => text.length * fontSize;
const PLACE = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };

describe("getDraftLineShift", () => {
  it("moves a line up by the gap between libass's win ascent and a browser's baseline in the line box", () => {
    // A display serif: content area 1.0 + 0.3 em, win ascent 1.3 em; a browser's baseline in a 1.15 line box at 0.925 em.
    expect(getDraftLineShift({ contentArea: { ascentEm: 1, descentEm: 0.3 }, drawnAscentEm: 1.3 }, 100, 1.15)).toBe(-37.5);
  });

  it("moves a line down when libass's ascent is the shorter", () => {
    expect(getDraftLineShift({ contentArea: { ascentEm: 1, descentEm: 0.2 }, drawnAscentEm: 0.9 }, 10, 1.2)).toBe(1);
  });

  it("leaves a font without its metrics where it was", () => {
    expect(getDraftLineShift({ contentArea: { ascentEm: 1, descentEm: 0.3 } }, 100, 1.15)).toBe(0);
    expect(getDraftLineShift({ drawnAscentEm: 1.3 }, 100, 1.15)).toBe(0);
  });

  it("reads the kit's DejaVu Sans Bold, whose win and hhea metrics agree, as almost in place", () => {
    const font = createDraftFont({ family: "DejaVu Sans", file: FOOTAGE_DRAFT_FONT.file }, DEJAVU);
    expect(font?.drawnAscentEm).toBeCloseTo(1901 / 2048, 6);
    expect(font?.drawnDescentEm).toBeCloseTo(483 / 2048, 6);
    // Line box 1.15 em, content area 2384 / 2048 em: the browser's baseline 0.007 em above libass's.
    expect(getDraftLineShift(font ?? {}, 100, 1.15)).toBeCloseTo(-0.7, 1);
  });

  it("reads Caveat's win ascent and descent", () => {
    const font = createDraftFont({ family: "Caveat", file: HAND_FONT.file }, CAVEAT);
    expect(font?.drawnAscentEm).toBeCloseTo(0.974, 6);
    expect(font?.drawnDescentEm).toBeCloseTo(0.315, 6);
  });
});

describe("getDraftMiddleShift", () => {
  it("moves a centred line by half the difference of the ascent less the descent", () => {
    // Browser: (1.0 - 0.3) / 2 = 0.35 em below the middle; libass: (1.3 - 0.4) / 2 = 0.45 em.
    expect(getDraftMiddleShift({ contentArea: { ascentEm: 1, descentEm: 0.3 }, drawnAscentEm: 1.3, drawnDescentEm: 0.4 }, 100)).toBe(-10);
  });

  it("leaves a font without its metrics where it was", () => {
    expect(getDraftMiddleShift({ contentArea: { ascentEm: 1, descentEm: 0.3 }, drawnAscentEm: 1.3 }, 100)).toBe(0);
    expect(getDraftMiddleShift({ drawnAscentEm: 1.3, drawnDescentEm: 0.4 }, 100)).toBe(0);
  });
});

describe("fitDraftCaptionPlace", () => {
  it("keeps the place without a line limit", () => {
    expect(fitDraftCaptionPlace({ words: ["aaaa", "bbbb", "cccc"], place: PLACE, width: 10, maxLines: undefined, minFontSize: 1, measure: PER_CHARACTER })).toBe(PLACE);
  });

  it("keeps the place of a chunk without words", () => {
    expect(fitDraftCaptionPlace({ words: [], place: PLACE, width: 10, maxLines: 2, minFontSize: 1, measure: PER_CHARACTER })).toBe(PLACE);
  });

  it("keeps the place when the words already fit", () => {
    // "aa bb" is 5 characters: 320 px at 64, one line of 400.
    expect(fitDraftCaptionPlace({ words: ["aa", "bb"], place: PLACE, width: 400, maxLines: 1, minFontSize: 40, measure: PER_CHARACTER })).toBe(PLACE);
  });

  it("shrinks the font in 1 px steps until the words take the lines allowed", () => {
    // Three words of 4: "aaaa bbbb" (9 characters) fits 400 px from 44 px; "cccc" goes on the second line.
    expect(fitDraftCaptionPlace({ words: ["aaaa", "bbbb", "cccc"], place: PLACE, width: 400, maxLines: 2, minFontSize: 20, measure: PER_CHARACTER })).toEqual({ ...PLACE, fontSize: 44 });
  });

  it("stops at the smallest size, as the render's fit does", () => {
    expect(fitDraftCaptionPlace({ words: ["aaaa", "bbbb", "cccc"], place: PLACE, width: 400, maxLines: 2, minFontSize: 50, measure: PER_CHARACTER })).toEqual({ ...PLACE, fontSize: 50 });
  });
});

describe("buildFootageDraftCaptions with captionMaxLines", () => {
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
    captions: true,
    captionPreset: "reels",
    captionStyle: "highlight",
    captionMaxWords: 4,
    endCard: null,
  };
  const edl = { version: 2 as const, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 10, transition: "cut" as const, motion: "none" as const }] };
  const said = ["We", "flew", "east", "today", "Extraordinary", "unforgettable", "mountains", "everywhere"];
  const words = said.map((text, index) => ({ text, start: 0.2 + index * 1, end: 0.2 + index * 1 + 0.8 }));
  const fonts = loadFootageDraftFonts({ body: { family: "DejaVu Sans", fallback: "sans-serif", files: [{ path: FOOTAGE_DRAFT_FONT.file, weight: "700", style: "normal", unicodeRange: null }] } });
  const build = (maxLines: number | undefined) =>
    buildFootageDraftCaptions({ film: { ...film, ...(maxLines === undefined ? {} : { captionMaxLines: maxLines }) }, edl, words, caption: PLACE, frame: LAYOUTS["9:16"].frame, fonts }) ?? "";
  const styles = (ass: string) => ass.split("\n").filter((line) => line.startsWith("Style: Caption"));

  it("draws a chunk that needs three lines at the box's size in a smaller style of its own", () => {
    const fitted = styles(build(2));
    expect(fitted).toHaveLength(2);
    const sizes = fitted.map((line) => Number(line.split(",")[2]));
    expect(sizes[0]).toBe(Math.round(64 * fonts.body.assScale * 100) / 100);
    expect(sizes[1]).toBeLessThan(sizes[0] ?? 0);
    expect(sizes[1]).toBeGreaterThanOrEqual(Math.round(45 * fonts.body.assScale * 100) / 100);
    expect(build(2)).toMatch(/^Dialogue: [^\n]*,Caption2,/m);
  });

  it("keeps one style at the box's size without a line limit", () => {
    expect(styles(build(undefined))).toHaveLength(1);
  });
});
