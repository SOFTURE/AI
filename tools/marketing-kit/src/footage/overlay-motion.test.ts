import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup, getPlaceCardTimes } from "./overlay-html.js";
import {
  BLUR_FROM_PX,
  OVERLAY_EASES,
  POP_FROM_SCALE,
  getEntranceMotion,
  getEntranceScaleAt,
  getExitMotion,
  getListItemStarts,
  getWipeHalves,
  type OverlayEase,
} from "./overlay-motion.js";
import { OVERLAY_EASINGS, OVERLAY_ENTRANCES, OVERLAY_EXITS, type EdlOverlay, type OverlayEntrance } from "./overlay-schema.js";
import { getPlaceCardPinRow, getTitleContentSize, resolveEdlOverlays, type ResolveOverlaysInput, type ResolvedOverlay } from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** RV-133 of an adopting app: new entrances (pop, rise, blur, wipe), exits, easings, a staggered list, a place card's pin and subtitle delay, a keyword's underline. */

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
const STYLE = { cornerRadius: "m", shadow: "soft", border: "none", padding: "m" } as const;
const SEGMENTS: Edl["segments"] = [{ id: "s1", clip: "talk", start: 0, end: 20, transition: "cut", motion: "none" }];
const WORDS = [
  { text: "first,", start: 2.4, end: 2.7 },
  { text: "Second", start: 3.1, end: 3.5 },
  { text: "third", start: 9, end: 9.4 },
];
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: WORDS, frame: FRAME, caption: CAPTION, ...changes });
}

function only<K extends ResolvedOverlay["kind"]>(overlay: EdlOverlay, kind: K, changes: Partial<ResolveOverlaysInput> = {}): Extract<ResolvedOverlay, { kind: K }> {
  const result = resolve([overlay], changes);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const [first] = result.overlays;
  if (first?.kind !== kind) throw new Error(`expected a ${kind}`);
  return first as Extract<ResolvedOverlay, { kind: K }>;
}

function markup(overlays: EdlOverlay[]): { html: string; css: string; tweens: string[] } {
  const result = resolve(overlays, { style: STYLE });
  if (!result.ok) throw new Error(result.problems.join("; "));
  const out = getOverlayMarkup(result.overlays, { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE });
  return { html: out.html.join(""), css: out.css.join(""), tweens: out.tweens };
}

function draft(overlays: EdlOverlay[], style: typeof STYLE | null = STYLE): string[] {
  const result = resolve(overlays, style === null ? {} : { style });
  if (!result.ok) throw new Error(result.problems.join("; "));
  const ass = buildFootageDraftCaptions({
    film,
    edl: edlWith(overlays),
    words: WORDS,
    caption: CAPTION,
    frame: FRAME,
    overlays: result.overlays,
    overlayColors: COLORS,
    ...(style === null ? {} : { style }),
  });
  return (ass ?? "").split("\n").filter((line) => line.startsWith("Dialogue:"));
}

const KEYWORD: EdlOverlay = { kind: "keyword", at: 1, duration: 2.5, text: "2 konwencje" };
const PLACE: EdlOverlay = { kind: "place_card", at: 1, duration: 3, text: "Ha Long Bay", subtitle: "A bay of 1600 islands" };
const LIST: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["35 zl", "3 days", "no queue"] };

describe("the motion model", () => {
  it("eases every curve from 0 to 1 without passing 1", () => {
    for (const ease of Object.keys(OVERLAY_EASES) as OverlayEase[]) {
      const values = Array.from({ length: 101 }, (_unused, step) => OVERLAY_EASES[ease](step / 100));
      expect(values[0]).toBe(0);
      expect(values.at(-1)).toBe(1);
      values.forEach((value, step) => {
        expect(value).toBeLessThanOrEqual(1);
        if (step > 0) expect(value).toBeGreaterThanOrEqual(values[step - 1] as number);
      });
    }
  });

  it("never grows any entrance past 100 % in any frame, a pop starting at 92 %", () => {
    for (const entrance of OVERLAY_ENTRANCES) {
      for (const easing of OVERLAY_EASINGS) {
        const motion = getEntranceMotion(entrance, easing, FRAME);
        const scales = Array.from({ length: 61 }, (_unused, frame) => getEntranceScaleAt(motion, frame / 60));
        expect(Math.max(...scales)).toBeLessThanOrEqual(1);
        expect(scales.at(-1)).toBe(1);
      }
    }
    const pop = getEntranceMotion("pop", "smooth", FRAME);
    expect(getEntranceScaleAt(pop, 0)).toBe(POP_FROM_SCALE);
    expect(getEntranceScaleAt(pop, -1)).toBe(POP_FROM_SCALE);
    expect(getEntranceScaleAt(pop, 0.15)).toBeCloseTo(0.92 + 0.08 * 0.75, 6);
  });

  it("times each entrance and shortens a snappy one on expo.out", () => {
    expect(getEntranceMotion("pop", "smooth", FRAME)).toEqual({ kind: "tween", from: { opacity: 0, scale: 0.92, y: 0, blur: 0 }, seconds: 0.3, ease: "power2.out" });
    expect(getEntranceMotion("rise", "smooth", FRAME)).toEqual({ kind: "tween", from: { opacity: 0, scale: 1, y: 96, blur: 0 }, seconds: 0.3, ease: "power3.out" });
    expect(getEntranceMotion("blur", "smooth", { width: 540, height: 960 })).toEqual({ kind: "tween", from: { opacity: 0, scale: 1, y: 0, blur: BLUR_FROM_PX / 2 }, seconds: 0.3, ease: "power2.out" });
    expect(getEntranceMotion("slide", "smooth", FRAME)).toEqual({ kind: "tween", from: { opacity: 0, scale: 1, y: 28, blur: 0 }, seconds: 0.5, ease: "power3.out" });
    expect(getEntranceMotion("fade", "smooth", FRAME)).toEqual({ kind: "tween", from: { opacity: 0, scale: 1, y: 0, blur: 0 }, seconds: 0.4, ease: "power2.out" });
    expect(getEntranceMotion("type", "smooth", FRAME)).toMatchObject({ seconds: 0.25 });
    expect(getEntranceMotion("wipe", "smooth", FRAME)).toEqual({ kind: "wipe", seconds: 0.5, ease: "power3.out" });
    expect(getEntranceMotion("wipe", "snappy", FRAME)).toEqual({ kind: "wipe", seconds: 0.35, ease: "expo.out" });
    expect(getEntranceMotion("pop", "snappy", FRAME)).toMatchObject({ seconds: 0.21, ease: "expo.out" });
    expect(getEntranceMotion("none", "snappy", FRAME)).toEqual({ kind: "none" });
    expect(getEntranceScaleAt({ kind: "none" }, 0)).toBe(1);
    expect(getWipeHalves(0.5)).toEqual({ grow: 0.25, reveal: 0.25 });
  });

  it("mirrors the entrance on auto and takes an exit named outright", () => {
    const exit = (entrance: OverlayEntrance | null, choice: (typeof OVERLAY_EXITS)[number] = "auto", easing: "smooth" | "snappy" = "smooth") => getExitMotion({ exit: choice, entrance, easing, frame: FRAME });
    const fade = { kind: "tween", from: { opacity: 0, scale: 1, y: 0, blur: 0 }, seconds: 0.3, ease: "power2.in" };
    expect(exit("fade")).toEqual(fade);
    expect(exit("type")).toEqual(fade);
    expect(exit("slide")).toEqual({ ...fade, from: { ...fade.from, y: 14 } });
    expect(exit("pop")).toEqual({ ...fade, from: { ...fade.from, scale: 0.96 } });
    expect(exit("rise")).toEqual({ ...fade, from: { ...fade.from, y: 48 } });
    expect(exit("blur")).toEqual({ ...fade, from: { ...fade.from, blur: 10 } });
    expect(exit("wipe")).toEqual({ kind: "wipe", seconds: 0.3, ease: "power2.in" });
    expect(exit("wipe", "auto", "snappy")).toEqual({ kind: "wipe", seconds: 0.21, ease: "power2.in" });
    expect(exit(null)).toEqual({ kind: "own" });
    expect(exit("none")).toEqual({ kind: "own" });
    expect(exit("pop", "none")).toEqual({ kind: "none" });
    expect(exit("pop", "fade")).toEqual(fade);
    expect(exit(null, "slide")).toEqual({ ...fade, from: { ...fade.from, y: 14 } });
    expect(exit("fade", "fade", "snappy")).toEqual({ ...fade, seconds: 0.21 });
  });

  it("brings a staggered list's points in on their words, else spaced over its first part", () => {
    expect(getListItemStarts({ start: 2, end: 6, count: 3, words: [1, 3.1, 9] })).toEqual([2, 3.1, 5.4]);
    // 40 % of 4 s over 3 points: 0.533 s apart.
    expect(getListItemStarts({ start: 2, end: 6, count: 3 })).toEqual([2.2, 2.733, 3.267]);
    // At least 0.25 s apart, at most 0.6 s, never past the last 0.6 s.
    expect(getListItemStarts({ start: 0, end: 1, count: 4 })).toEqual([0.2, 0.4, 0.4, 0.4]);
    expect(getListItemStarts({ start: 0, end: 8, count: 2 })).toEqual([0.2, 0.8]);
    expect(getListItemStarts({ start: 0, end: 0.5, count: 2 })).toEqual([0, 0]);
  });
});

describe("the new knobs' schema", () => {
  const error = (overlay: EdlOverlay): string => {
    const result = readEdl(edlWith([overlay]));
    return result.ok ? "" : result.error;
  };

  it("takes the new entrances, exits and easings on every card kind", () => {
    for (const entrance of ["pop", "rise", "blur", "wipe"] as const) {
      for (const kind of ["keyword", "lower_third", "hook_title", "search_bar", "place_card", "date_stamp"] as const) {
        expect(error({ kind, at: 1, duration: 2, text: "Hue", style: { entrance, exit: "slide", easing: "snappy" } })).toBe("");
      }
      expect(error({ ...LIST, style: { entrance } })).toBe("");
      expect(error({ kind: "counter", at: 1, duration: 2, value: 3, style: { entrance } })).toBe("");
      expect(error({ kind: "arrow", at: 1, duration: 2, anchor: { x: 500, y: 500 }, style: { entrance } })).toContain("an arrow enters by fade, none");
    }
  });

  it("refuses a knob on a kind that has no use for it", () => {
    expect(error({ ...KEYWORD, style: { stagger: true } })).toContain("only a list has points to stagger");
    expect(error({ ...LIST, style: { pin: "drop" } })).toContain("only a place_card draws a pin");
    expect(error({ ...LIST, style: { underline: true } })).toContain("only a keyword is underlined");
    expect(error({ ...KEYWORD, style: { subtitle_delay: 0.2 } })).toContain("only a place_card has a subtitle; leave subtitle_delay out");
    expect(error({ ...PLACE, style: { subtitle_delay: 0.7 } })).toContain("subtitle_delay");
    expect(error({ kind: "punch_in", at: 1, duration: 2, style: { exit: "fade" } })).toContain("overlays.0.style.exit: a punch_in eases the picture itself");
    expect(error({ kind: "punch_in", at: 1, duration: 2, style: { easing: "snappy" } })).toContain("overlays.0.style.easing: a punch_in eases the picture itself");
    expect(error({ ...KEYWORD, item_words: [{ text: "a" }, { text: "b" }] })).toContain("a keyword has no points; leave item_words out");
    expect(error({ ...LIST, item_words: [{ text: "a" }, { text: "b" }] })).toContain("gives 2 words for 3 points; one word per point");
    expect(error({ ...LIST, item_words: [{ text: "a" }, { text: "b" }, { text: "c", occurrence: 2 }] })).toBe("");
    expect(error({ ...PLACE, style: { pin: "drop", subtitle_delay: 0.6 } })).toBe("");
  });
});

describe("resolving the new knobs", () => {
  it("keeps a look without the new knobs as it was: no exit, easing, pin, delay, underline or item seconds", () => {
    expect(only(KEYWORD, "keyword")).not.toHaveProperty("underline");
    expect(only(KEYWORD, "keyword")).not.toHaveProperty("exit");
    expect(only({ ...KEYWORD, style: { exit: "auto", easing: "smooth" } }, "keyword")).not.toHaveProperty("easing");
    expect(only({ ...PLACE, style: { pin: "none", subtitle_delay: 0 } }, "place_card")).not.toHaveProperty("pin");
    expect(only({ ...PLACE, style: { subtitle_delay: 0 } }, "place_card")).not.toHaveProperty("subtitleDelay");
    expect(only({ ...PLACE, subtitle: undefined, style: { subtitle_delay: 0.4 } }, "place_card")).not.toHaveProperty("subtitleDelay");
    expect(only(LIST, "list")).not.toHaveProperty("itemStarts");
  });

  it("carries an exit, an easing, an underline, a pin and a subtitle delay", () => {
    expect(only({ ...KEYWORD, style: { exit: "none", easing: "snappy", underline: true } }, "keyword")).toMatchObject({ exit: "none", easing: "snappy", underline: true });
    expect(only({ ...PLACE, style: { pin: "drop", subtitle_delay: 0.3 } }, "place_card")).toMatchObject({ pin: "drop", subtitleDelay: 0.3 });
  });

  it("makes a place card with a pin taller by the pin's row, its text block lower", () => {
    const plain = only(PLACE, "place_card");
    const pinned = only({ ...PLACE, style: { pin: "static" } }, "place_card");
    expect(pinned.box.height - plain.box.height).toBe(getPlaceCardPinRow(plain.fontSize));
    expect(getTitleContentSize({ kind: "place_card", lines: ["I"], fontSize: 100, second: null, secondSize: 50, pin: true })).toEqual({ width: 56, height: 105 + 60 });
  });

  it("brings a list's points in on their words or spaced automatically", () => {
    expect(only({ ...LIST, item_words: [{ text: "First" }, { text: "second" }, { text: "third" }] }, "list").itemStarts).toEqual([2.4, 3.1, 5.4]);
    expect(only({ ...LIST, style: { stagger: true } }, "list").itemStarts).toEqual([2.2, 2.733, 3.267]);
    const missing = resolve([{ ...LIST, item_words: [{ text: "first" }, { text: "fourth" }, { text: "first", occurrence: 2 }] }]);
    expect(missing.ok ? [] : missing.problems).toEqual([
      'overlays[0].item_words[1]: no word "fourth" in the cut; the film never says it',
      'overlays[0].item_words[2]: no word "first" (occurrence 2) in the cut; the film says it 1 time',
    ]);
  });
});

describe("the render's motion", () => {
  const every: EdlOverlay[] = [
    { ...KEYWORD, style: { entrance: "pop" } },
    { kind: "lower_third", at: 5, duration: 2, text: "Hue" },
    { ...LIST, at: 9, style: { entrance: "rise", stagger: true } },
    { ...PLACE, at: 14, style: { entrance: "blur" } },
  ];

  it("eases nothing with a bounce, an elastic or a back overshoot, the soft pill included", () => {
    const all = [...markup(every).tweens, ...markup([{ ...KEYWORD, style: { entrance: "wipe" } }]).tweens, ...markup([{ kind: "lower_third", at: 1, duration: 2, text: "Hue" }]).tweens].join("\n");
    expect(all).not.toMatch(/back\.|elastic|bounce/);
    expect(markup([{ kind: "lower_third", at: 1, duration: 2, text: "Hue" }]).tweens).toContain('tl.fromTo("#ov0d", { scale: 0 }, { scale: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, 1.25);');
    // Every scale a tween ends on is at most 1.
    for (const match of all.matchAll(/\}, \{ ([^}]*)\}/g)) {
      const scale = /scale: ([\d.]+)/.exec(match[1] ?? "");
      if (scale !== null) expect(Number(scale[1])).toBeLessThanOrEqual(1);
    }
  });

  it("pops, rises and blurs a card in and mirrors it on the way out", () => {
    const { tweens } = markup(every);
    expect(tweens).toContain('tl.fromTo("#ov0 .ov-card", { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 1);');
    expect(tweens).toContain('tl.to("#ov0 .ov-card", { opacity: 0, scale: 0.96, duration: 0.3, ease: "power2.in" }, 3.2);');
    expect(tweens).toContain('tl.fromTo("#ov2 .ov-card", { opacity: 0, y: 96 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: false }, 9);');
    expect(tweens).toContain('tl.to("#ov2 .ov-card", { opacity: 0, y: 48, duration: 0.3, ease: "power2.in" }, 12.7);');
    expect(tweens).toContain('tl.fromTo("#ov3 .ov-card", { opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power2.out", immediateRender: false }, 14);');
    expect(tweens).toContain('tl.to("#ov3 .ov-card", { opacity: 0, filter: "blur(10px)", duration: 0.3, ease: "power2.in" }, 16.7);');
    // The soft pill without an entrance keeps its own exit.
    expect(tweens).toContain('tl.to("#ov1 .ov-card", { scale: 0.94, y: 14, opacity: 0, duration: 0.3, ease: "power2.in" }, 6.7);');
  });

  it("wipes a card in under an accent panel and off to the right, and leaves at once on exit none", () => {
    const wipe = markup([{ ...KEYWORD, style: { entrance: "wipe", easing: "snappy" } }]);
    expect(wipe.html).toContain('<i class="ov-wipe" id="ov0w"></i>');
    expect(wipe.css).toContain(".ov-wipe{position:absolute;inset:0;border-radius:inherit;background:#e8336b;transform-origin:100% 50%}");
    expect(wipe.tweens).toEqual([
      'tl.fromTo("#ov0 .ov-card", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.175, ease: "expo.out", immediateRender: false }, 1);',
      'tl.fromTo("#ov0 .ov-card .ov-wipe", { scaleX: 1 }, { scaleX: 0, duration: 0.175, ease: "expo.out", immediateRender: false }, 1.175);',
      'tl.to("#ov0 .ov-card", { clipPath: "inset(0% 0% 0% 100%)", duration: 0.21, ease: "power2.in" }, 3.29);',
    ]);
    const cards = markup([{ ...PLACE, style: { entrance: "wipe", exit: "none" } }]);
    expect(cards.html).toMatch(/<div class="ov-card ov-stack"[^>]*><i class="ov-wipe" id="ov0w"><\/i><div class="ov-line">/);
    expect(cards.tweens.some((tween) => tween.startsWith("tl.to("))).toBe(false);
    expect(markup([PLACE]).html).not.toContain("__WIPE__");
  });

  it("brings a staggered list's points in one by one, hidden until their second", () => {
    const { html, css, tweens } = markup([{ ...LIST, item_words: [{ text: "first" }, { text: "second" }, { text: "third" }] }]);
    expect(html).toContain('class="clip ov ov-list st"');
    expect(css).toContain(".st li,.pd .ov-pinrow svg,.pl .ov-line,.sd .ov-sub{opacity:0}");
    expect(tweens.filter((tween) => tween.includes("#ov0i"))).toEqual([
      'tl.fromTo("#ov0i0", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, 2.4);',
      'tl.fromTo("#ov0i1", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, 3.1);',
      'tl.fromTo("#ov0i2", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, 5.4);',
    ]);
  });

  it("drops a place card's pin first, then its title, then its subtitle after its delay", () => {
    const overlay: EdlOverlay = { ...PLACE, style: { entrance: "pop", pin: "drop", subtitle_delay: 0.3 } };
    const { html, tweens } = markup([overlay]);
    expect(html).toContain('class="clip ov ov-place-card center pd pl sd"');
    expect(html).toMatch(/<div class="ov-pinrow" id="ov0p" style="height:\d+px"><svg class="ov-pin" style="width:46px;height:46px"/);
    expect(tweens).toContain('tl.fromTo("#ov0p svg", { opacity: 0, y: -27.6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, 1);');
    expect(tweens).toContain('tl.fromTo("#ov0 .ov-line", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, 1.2);');
    expect(tweens).toContain('tl.fromTo("#ov0 .ov-sub", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, 1.5);');
    const placed = only(overlay, "place_card");
    expect(getPlaceCardTimes(placed)).toEqual({ pin: 1, title: 1.2, subtitle: 1.5 });
    expect(getPlaceCardTimes({ ...placed, pin: undefined, subtitleDelay: undefined })).toEqual({ pin: null, title: 1, subtitle: 1 });
    expect(getPlaceCardTimes({ ...placed, subtitle: null })).toEqual({ pin: 1, title: 1.2, subtitle: null });
    // A static pin is there with the card; a typed title is not held back for it.
    const still = markup([{ ...PLACE, style: { pin: "static", entrance: "type" } }]);
    expect(still.html).toContain('class="clip ov ov-place-card center ty"');
    expect(still.tweens.some((tween) => tween.includes("#ov0p") || tween.includes(".ov-line"))).toBe(false);
  });

  it("draws a keyword's underline once the keyword is in, without the card's own accent edge", () => {
    const { html, css, tweens } = markup([{ ...KEYWORD, style: { entrance: "rise", underline: true } }]);
    expect(html).toContain('class="clip ov ov-keyword right ul"');
    expect(html).toContain('<i class="ov-ul" id="ov0u" style="left:0.6em;right:0.6em;bottom:0.21em"></i>');
    expect(css).toContain(".ov-keyword.ul .ov-card{border-bottom-color:transparent}");
    expect(tweens).toContain('tl.fromTo("#ov0u", { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, 1.3);');
    // Without an entrance, after the soft pill's 0.45 s; with none, at once.
    expect(markup([{ ...KEYWORD, style: { underline: true } }]).tweens.at(-2)).toContain("1.45);");
    expect(markup([{ ...KEYWORD, style: { entrance: "none", underline: true } }]).tweens.at(-2)).toContain(", 1);");
  });

  it("fades a mark out its own way, or not at all on exit none", () => {
    const arrow: EdlOverlay = { kind: "arrow", at: 1, duration: 2, anchor: { x: 800, y: 900 }, style: { entrance: "fade", exit: "none", easing: "snappy" } };
    const { tweens } = markup([arrow]);
    expect(tweens).toContain('tl.fromTo("#ov0 .ov-svg", { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "expo.out", immediateRender: false }, 1);');
    expect(tweens.some((tween) => tween.startsWith('tl.to("#ov0 .ov-svg"'))).toBe(false);
  });
});

describe("the draft's motion", () => {
  it("pops a card about its middle: the scale grows while the position moves with it", () => {
    const lines = draft([{ ...KEYWORD, style: { entrance: "pop" } }], null);
    const card = only(KEYWORD, "keyword");
    expect(lines[0]).toMatch(/^Dialogue: 3,0:00:01\.00,0:00:03\.50,OverlayShape,,0,0,0,,\{\\an7\\move\((\d+),(\d+),0,0,0,300\)\\fad\(210,250\)\\fscx92\\fscy92\\t\(0,300,\\fscx100\\fscy100\)\\1c&H2B1A1D&\\p1\}/);
    const [, x, y] = /\\move\((\d+),(\d+)/.exec(lines[0] ?? "") ?? [];
    expect(Number(x)).toBeGreaterThan(0);
    expect(Number(y)).toBeGreaterThan(0);
    expect(lines[1]).toMatch(/\\an9\\fs84\\move\(\d+,\d+,\d+,\d+,0,300\)\\fad\(210,250\)\\fscx92\\fscy92\\t\(0,300,\\fscx100\\fscy100\)\}2 konwencje$/);
    expect(card.box.width).toBeGreaterThan(0);
  });

  it("rises, blurs and wipes in, the shadow keeping its own blur", () => {
    const rise = draft([{ ...KEYWORD, style: { entrance: "rise", exit: "fade" } }]);
    expect(rise.every((line) => /\\move\(\d+,\d+,\d+,\d+,0,300\)\\fad\(210,250\)/.test(line))).toBe(true);
    const blur = draft([{ ...KEYWORD, style: { entrance: "blur" } }]);
    expect(blur[0]).toContain("\\blur15\\t(0,300,\\blur15)\\t(2200,2500,\\blur15)");
    expect(blur[1]).toContain("\\blur7\\t(0,300,\\blur0)\\t(2200,2500,\\blur5)");
    const wipe = draft([{ ...KEYWORD, style: { entrance: "wipe" } }]);
    const panel = wipe.find((line) => line.startsWith("Dialogue: 3,0:00:01.00,0:00:01.50,"));
    expect(panel).toMatch(/\\clip\((\d+),(\d+),\1,(\d+)\)\\t\(0,250,\\clip\(\1,\2,(\d+),\3\)\)\\t\(250,500,\\clip\(\4,\2,\4,\3\)\)\\1c&H6B33E8&/);
    expect(wipe[1]).toMatch(/\\clip\((\d+),(\d+),\1,(\d+)\)\\t\(0,250,\\clip\(\1,\2,(\d+),\3\)\)\\t\(2200,2500,\\clip\(\4,\2,\4,\3\)\)/);
    const text = wipe.find((line) => line.startsWith("Dialogue: 4,"));
    expect(text).toMatch(/\\clip\((\d+),(\d+),\1,(\d+)\)\\t\(250,500,\\clip\(\1,\2,(\d+),\3\)\)\\t\(2200,2500,/);
  });

  it("leaves by sliding down when the card did not move in, at once on none, quicker when snappy", () => {
    const slide = draft([{ ...KEYWORD, style: { entrance: "fade", exit: "slide" } }], null);
    expect(slide[0]).toContain("\\move(0,0,0,14,2200,2500)\\fad(150,250)");
    const none = draft([{ ...KEYWORD, style: { entrance: "fade", exit: "none", easing: "snappy" } }], null);
    expect(none[0]).toContain("\\pos(0,0)\\fad(150,0)");
    const snappy = draft([{ ...KEYWORD, style: { entrance: "fade", easing: "snappy" } }], null);
    expect(snappy[0]).toContain("\\fad(150,175)");
    const wipeOff = draft([{ ...KEYWORD, style: { entrance: "fade", exit: "fade" } }], null);
    expect(wipeOff[0]).toContain("\\fad(150,250)");
  });

  it("wipes a card off when only its exit mirrors a wipe, and draws an underline that leaves as the wipe starts", () => {
    const lines = draft([{ ...KEYWORD, style: { entrance: "wipe", underline: true } }]);
    const bar = lines.find((line) => line.startsWith("Dialogue: 4,0:00:01.50,"));
    expect(bar).toMatch(/^Dialogue: 4,0:00:01\.50,0:00:03\.20,OverlayShape,,0,0,0,,\{\\an7\\pos\(0,0\)\\fad\(0,250\)\\clip\((\d+),\d+,\1,\d+\)\\t\(0,350,\\clip\(/);
    const plain = draft([{ ...KEYWORD, style: { underline: true, exit: "none" } }], null);
    expect(plain.at(-1)).toMatch(/^Dialogue: 4,0:00:01\.40,0:00:03\.50,OverlayShape,,0,0,0,,\{\\an7\\pos\(0,0\)\\clip/);
    const snappy = draft([{ ...KEYWORD, style: { underline: true, entrance: "none", easing: "snappy" } }], null);
    expect(snappy.at(-1)).toMatch(/^Dialogue: 4,0:00:01\.00,0:00:03\.50,.*\\fad\(0,175\)/);
  });

  it("brings a staggered list's points in on their seconds, each fading in", () => {
    const lines = draft([{ ...LIST, style: { entrance: "slide", stagger: true } }], null);
    expect(lines.filter((line) => line.startsWith("Dialogue: 4,")).map((line) => line.slice(0, 34))).toEqual([
      "Dialogue: 4,0:00:02.20,0:00:06.00,",
      "Dialogue: 4,0:00:02.73,0:00:06.00,",
      "Dialogue: 4,0:00:03.27,0:00:06.00,",
    ]);
    const second = lines.find((line) => line.endsWith("3 days")) ?? "";
    expect(second).toContain("\\fad(150,250)}");
    expect(second).not.toContain("\\move");
  });

  it("drops a place card's pin, then fades its title and its subtitle in after it", () => {
    const lines = draft([{ ...PLACE, style: { entrance: "pop", pin: "drop", subtitle_delay: 0.3 } }], null);
    expect(lines.find((line) => line.includes("\\move(0,-28,0,0,0,350)"))).toMatch(/^Dialogue: 4,0:00:01\.00,0:00:04\.00,OverlayShape,,0,0,0,,\{\\an7\\move\(0,-28,0,0,0,350\)\\fad\(210,250\)\\1c&H6B33E8&\\p1\}/);
    expect(lines.find((line) => line.endsWith("}Ha Long Bay"))).toMatch(/^Dialogue: 4,0:00:01\.20,0:00:04\.00,.*\\pos\(\d+,\d+\)\\fad\(150,250\)\}Ha Long Bay$/);
    expect(lines.find((line) => line.endsWith("}A bay of 1600 islands"))).toMatch(/^Dialogue: 4,0:00:01\.50,0:00:04\.00,/);
    const still = draft([{ ...PLACE, style: { pin: "static", exit: "none" } }], null);
    expect(still.find((line) => line.includes("&H6B33E8&"))).toMatch(/^Dialogue: 4,0:00:01\.00,0:00:04\.00,OverlayShape,,0,0,0,,\{\\an7\\move\(0,28,0,0,0,300\)\\fad\(150,0\)/);
    const dropNone = draft([{ ...PLACE, style: { pin: "drop", exit: "none", easing: "snappy" } }], null);
    expect(dropNone.find((line) => line.includes("\\move(0,-28"))).toContain("\\fad(210,0)");
    const dropSnappy = draft([{ ...PLACE, style: { pin: "drop", easing: "snappy" } }], null);
    expect(dropSnappy.find((line) => line.includes("\\move(0,-28"))).toContain("\\fad(210,175)");
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the draft's motion burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grab(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "motion-")) : dir;
    const result = resolve(overlays, { style: STYLE });
    if (!result.ok) throw new Error(result.problems.join("; "));
    const ass = buildFootageDraftCaptions({ film, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: result.overlays, overlayColors: COLORS, style: STYLE });
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

  /** How many pixels of a box are near a colour. */
  function count(frame: Buffer, box: { left: number; top: number; width: number; height: number }, hex: string): number {
    const want = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    let found = 0;
    for (let y = Math.round(box.top); y < box.top + box.height; y++) {
      for (let x = Math.round(box.left); x < box.left + box.width; x++) {
        const at = (y * FRAME.width + x) * 3;
        if (want.every((value, channel) => Math.abs((frame[at + channel] ?? 0) - value) <= 40)) found++;
      }
    }
    return found;
  }

  it("shows a popped place card's pin, title and subtitle in that order", () => {
    const overlay: EdlOverlay = { ...PLACE, style: { entrance: "pop", pin: "drop", subtitle_delay: 0.3 } };
    const card = only(overlay, "place_card", { style: STYLE }).box;
    const thirds = (part: number) => ({ left: card.left, top: card.top + (card.height * part) / 3, width: card.width, height: card.height / 3 });
    const seen = [1.22, 1.45, 1.9].map((second) => {
      const frame = grab([overlay], second);
      return { pin: count(frame, thirds(0), COLORS.accent) > 30, title: count(frame, thirds(1), COLORS.foreground) > 200, subtitle: count(frame, thirds(2), COLORS.foreground) > 100 };
    });
    expect(seen).toEqual([
      { pin: true, title: false, subtitle: false },
      { pin: true, title: true, subtitle: false },
      { pin: true, title: true, subtitle: true },
    ]);
  });

  it("shows a staggered list's points one by one", () => {
    const overlay: EdlOverlay = { ...LIST, item_words: [{ text: "first" }, { text: "second" }, { text: "third" }] };
    const card = only(overlay, "list", { style: STYLE }).box;
    const row = (index: number) => ({ left: card.left, top: card.top + (card.height * index) / 3, width: card.width, height: card.height / 3 });
    const shown = [2.9, 3.6, 5.6].map((second) => {
      const frame = grab([overlay], second);
      return [0, 1, 2].map((index) => count(frame, row(index), COLORS.foreground) > 50);
    });
    expect(shown).toEqual([
      [true, false, false],
      [true, true, false],
      [true, true, true],
    ]);
  });
});
