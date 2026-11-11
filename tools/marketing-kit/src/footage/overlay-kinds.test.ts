import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "./compose.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { getGlassDrawing, getPinDrawing, getRoundedRectDrawing } from "./draft-overlays.js";
import { readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getCounterSeconds, getOverlayColors, getOverlayMarkup, getScriptLocale, getTypingTimes } from "./overlay-html.js";
import { isTypedOverlay, type EdlOverlay } from "./overlay-schema.js";
import {
  estimateTextWidth,
  formatOverlayNumber,
  getCounterDecimals,
  getOverlayBounds,
  getOverlaySafeZone,
  getOverlayTexts,
  getOverlayTextsByRole,
  resolveEdlOverlays,
  wrapOverlayText,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
} from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** The travel overlays (hook title, search bar, place card, counter, date stamp) and every overlay's style knobs. */

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
  endCard: null,
};

const SEGMENTS: Edl["segments"] = [
  { id: "s1", clip: "talk", start: 0, end: 10, transition: "cut", motion: "none" },
  { id: "s2", clip: "talk", start: 20, end: 40, transition: "cut", motion: "none" },
];

const WORDS = [{ text: "Hanoi", start: 0.4, end: 0.9 }];
const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const ZONE = getOverlaySafeZone(film, FRAME);
const ROOM = 1080 - ZONE.left - ZONE.right - 48;

const COLORS = {
  background: "#1d1a2b",
  foreground: "#fdf7f2",
  muted: "#a3a6ad",
  accent: "#e8336b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#1d1a2b",
  captionText: "#fdf7f2",
  captionHighlight: "#e8336b",
};

const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: WORDS, frame: FRAME, caption: CAPTION, ...changes });
}

function resolved(overlays: EdlOverlay[]): ResolvedOverlay[] {
  const result = resolve(overlays);
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

function problems(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}): string[] {
  const result = resolve(overlays, changes);
  return result.ok ? [] : result.problems;
}

function only<K extends ResolvedOverlay["kind"]>(overlay: EdlOverlay, kind: K): Extract<ResolvedOverlay, { kind: K }> {
  const [first] = resolved([overlay]);
  if (first?.kind !== kind) throw new Error(`expected a ${kind}`);
  return first as Extract<ResolvedOverlay, { kind: K }>;
}

const HOOK: EdlOverlay = { kind: "hook_title", at: 0, duration: 15, text: "How much does a week in Vietnam cost?", place: "Hanoi, Vietnam" };
const SEARCH: EdlOverlay = { kind: "search_bar", at: 1, duration: 3, text: "cheap stay Hanoi" };
const PLACE: EdlOverlay = { kind: "place_card", at: 21, duration: 3, text: "Ha Long Bay", subtitle: "A bay of 1600 islands" };
const COUNTER: EdlOverlay = { kind: "counter", at: 5, duration: 3, value: 1250, unit: "km" };
const DATE: EdlOverlay = { kind: "date_stamp", at: 25, duration: 3, text: "Day 12", place: "Hoi An", style: { side: "right" } };

describe("the new kinds' schema", () => {
  const read = (overlay: object) => readEdl({ version: 2, film: "trip", segments: SEGMENTS, overlays: [overlay] });
  const error = (overlay: object) => {
    const result = read(overlay);
    return result.ok ? "" : result.error;
  };

  it("reads every new kind with what it needs, and every knob", () => {
    for (const overlay of [
      HOOK,
      { kind: "hook_title", at: 0, duration: 180, text: "Why Asia?" },
      SEARCH,
      { ...SEARCH, style: { entrance: "slide", typing_speed: undefined } },
      { ...SEARCH, style: { typing_speed: 20, position: "top", size: "l" } },
      PLACE,
      { kind: "place_card", at: 21, duration: 3, text: "Hue", style: { entrance: "type", typing_speed: 8 } },
      COUNTER,
      { kind: "counter", at: 5, duration: 3, value: 12.5, from: 2.25, style: { position: "top", entrance: "slide" } },
      DATE,
      { kind: "lower_third", at: 1, duration: 2, text: "Hanoi", style: { position: "top", entrance: "type", colors: { card: "#ffffff", text: "#000000", accent: "#FF0000" } } },
      { kind: "keyword", at: 1, duration: 2, text: "3x", style: { entrance: "none", position: "bottom" } },
      { kind: "list", at: 1, duration: 2, items: ["a", "b"], style: { entrance: "fade", position: "top" } },
      { kind: "arrow", at: 1, duration: 2, anchor: { x: 500, y: 600 }, style: { entrance: "fade", colors: { accent: "#00ff00" } } },
      { kind: "highlight", at: 1, duration: 2, anchor: { x: 300, y: 500, width: 100, height: 100 }, style: { entrance: "none" } },
      { kind: "punch_in", at: 1, duration: 2, style: { size: "s" } },
    ]) {
      expect(read(overlay).ok, JSON.stringify(overlay)).toBe(true);
    }
  });

  it("refuses a field a kind does not take and one it needs, at the kit's bounds", () => {
    expect(error({ kind: "hook_title", at: 0, duration: 2 })).toBe("overlays.0.text: a hook_title needs its text");
    expect(error({ ...HOOK, text: "x".repeat(65) })).toBe("overlays.0.text: is longer than 64 characters");
    expect(error({ ...HOOK, place: "x".repeat(41) })).toBe("overlays.0.place: is longer than 40 characters");
    expect(error({ ...SEARCH, text: "x".repeat(41) })).toBe("overlays.0.text: is longer than 40 characters");
    expect(error({ ...PLACE, text: "x".repeat(29) })).toBe("overlays.0.text: is longer than 28 characters");
    expect(error({ ...PLACE, subtitle: "x".repeat(41) })).toBe("overlays.0.subtitle: is longer than 40 characters");
    expect(error({ ...DATE, text: "x".repeat(25) })).toBe("overlays.0.text: is longer than 24 characters");
    expect(error({ ...COUNTER, unit: "x".repeat(13) })).toBe("overlays.0.unit: is longer than 12 characters");
    expect(error({ kind: "keyword", at: 1, duration: 2, text: "x", place: "Hanoi" })).toBe("overlays.0.place: a keyword has no place label; leave it out");
    expect(error({ ...HOOK, subtitle: "x" })).toBe("overlays.0.subtitle: a hook_title has no subtitle; leave it out");
    expect(error({ kind: "counter", at: 1, duration: 2 })).toBe("overlays.0.value: a counter needs its value");
    expect(error({ ...COUNTER, text: "x" })).toBe("overlays.0.text: a counter draws no text; leave it out");
    expect(error({ ...COUNTER, from: 1250 })).toBe("overlays.0.from: a counter counts up: from must be below value");
    expect(error({ ...COUNTER, value: 1.005 })).toBe("overlays.0.value: has more than two decimals");
    expect(error({ ...COUNTER, value: 1_000_000_000 })).toBe("overlays.0.value: Too big: expected number to be <=999999999");
    expect(error({ kind: "keyword", at: 1, duration: 2, text: "x", value: 3 })).toBe("overlays.0.value: a keyword counts nothing; leave value out");
    expect(error({ kind: "keyword", at: 1, duration: 9, text: "x" })).toBe("overlays.0.duration: a keyword stays at most 8 s (only a hook_title stays longer)");
    expect(error({ ...HOOK, duration: 181 })).toBe("overlays.0.duration: Too big: expected number to be <=180");
  });

  it("refuses a style knob a kind does not take", () => {
    expect(error({ ...HOOK, style: { side: "left" } })).toBe("overlays.0.style.side: a hook_title has no side; leave it out");
    expect(error({ ...HOOK, style: { position: "middle" } })).toBe("overlays.0.style.position: a hook_title has a fixed place; leave position out");
    expect(error({ kind: "list", at: 1, duration: 2, items: ["a", "b"], style: { position: "bottom" } })).toBe("overlays.0.style.position: a list sits at top, middle");
    expect(error({ kind: "punch_in", at: 1, duration: 2, style: { entrance: "fade" } })).toBe("overlays.0.style.entrance: a punch_in has no entrance; leave it out");
    expect(error({ kind: "list", at: 1, duration: 2, items: ["a", "b"], style: { entrance: "type" } })).toBe("overlays.0.style.entrance: a list enters by fade, slide, none, pop, rise, blur, wipe");
    expect(error({ kind: "keyword", at: 1, duration: 2, text: "x", style: { typing_speed: 10 } })).toBe("overlays.0.style.typing_speed: only a typed entrance or a search bar has a typing speed");
    expect(error({ ...SEARCH, style: { entrance: "fade", typing_speed: 10 } })).toBe("overlays.0.style.typing_speed: only a typed entrance or a search bar has a typing speed");
    expect(error({ ...SEARCH, style: { typing_speed: 3 } })).toBe("overlays.0.style.typing_speed: Too small: expected number to be >=4");
    expect(error({ kind: "punch_in", at: 1, duration: 2, style: { colors: { accent: "#ffffff" } } })).toBe("overlays.0.style.colors: a punch_in draws nothing to colour; leave colors out");
    expect(error({ kind: "arrow", at: 1, duration: 2, anchor: { x: 500, y: 600 }, style: { colors: { card: "#ffffff" } } })).toBe(
      "overlays.0.style.colors: an arrow draws in its accent only; leave card and text out",
    );
    expect(error({ ...SEARCH, style: { colors: { card: "red" } } })).toBe("overlays.0.style.colors.card: is not a #rrggbb colour");
  });

  it("types a search bar by default and any text overlay with the type entrance", () => {
    expect(isTypedOverlay({ kind: "search_bar" })).toBe(true);
    expect(isTypedOverlay({ kind: "search_bar", style: { entrance: "fade" } })).toBe(false);
    expect(isTypedOverlay({ kind: "keyword", style: { entrance: "type" } })).toBe(true);
    expect(isTypedOverlay({ kind: "keyword" })).toBe(false);
  });
});

describe("placing the new kinds", () => {
  it("measures and wraps text by its estimate", () => {
    expect(estimateTextWidth("abcd", 100)).toBe(224);
    expect(wrapOverlayText("one two three", 100, 450)).toEqual(["one two", "three"]);
    expect(wrapOverlayText("  ", 100, 450)).toEqual([]);
    expect(getCounterDecimals(12, 0)).toBe(0);
    expect(getCounterDecimals(12.5, 0)).toBe(1);
    expect(getCounterDecimals(3, 1.25)).toBe(2);
    expect(formatOverlayNumber(12345.5, 1, "en-US")).toBe("12,345.5");
    expect(formatOverlayNumber(12345, 0, "pl-PL")).toBe("12 345");
  });

  it("puts the hook title at the top, centred, its place label above two lines", () => {
    const hook = only(HOOK, "hook_title");
    expect(hook.lines).toEqual(["How much does a week", "in Vietnam cost?"]);
    expect(hook).toMatchObject({ place: "Hanoi, Vietnam", fontSize: 64, placeFontSize: 35, entrance: null, typing: null, colors: {} });
    expect(hook.box.top).toBe(ZONE.top);
    expect(Math.abs(hook.box.left + hook.box.width / 2 - (ZONE.left + 24 + ROOM / 2))).toBeLessThanOrEqual(1);
    const bare = only({ kind: "hook_title", at: 0, duration: 2, text: "Why?" }, "hook_title");
    expect(bare.place).toBeNull();
    expect(bare.box.height).toBeLessThan(hook.box.height);
  });

  it("places a search field wide, a place card and a counter in the middle by default and at their positions", () => {
    const search = only(SEARCH, "search_bar");
    expect(search).toMatchObject({ text: "cheap stay Hanoi", fontSize: 42, typing: 14 });
    expect(search.box.width).toBeGreaterThanOrEqual(Math.round(ROOM * 0.82));
    const middle = only(PLACE, "place_card");
    expect(middle).toMatchObject({ lines: ["Ha Long Bay"], subtitle: "A bay of 1600 islands", subtitleFontSize: 51 });
    const top = only({ ...PLACE, style: { position: "top" } }, "place_card");
    const bottom = only({ ...PLACE, style: { position: "bottom" } }, "place_card");
    expect(top.box.top).toBe(ZONE.top);
    expect(top.box.top).toBeLessThan(middle.box.top);
    expect(middle.box.top).toBeLessThan(bottom.box.top);
    const counter = only({ ...COUNTER, from: 0.5, value: 12.25 }, "counter");
    expect(counter).toMatchObject({ value: 12.25, from: 0.5, decimals: 2, unit: "km", unitFontSize: 54 });
    expect(only({ kind: "counter", at: 5, duration: 3, value: 7 }, "counter")).toMatchObject({ from: 0, unit: null });
  });

  it("puts a date stamp in a top corner and a lower third at the top on its word", () => {
    const right = only(DATE, "date_stamp");
    expect(right.box.top).toBe(ZONE.top);
    expect(right.box.left + right.box.width).toBe(1080 - ZONE.right - 24);
    const left = only({ kind: "date_stamp", at: 25, duration: 3, text: "Day 12" }, "date_stamp");
    expect([left.box.left, left.side, left.place]).toEqual([ZONE.left + 24, "left", null]);
    const third = only({ kind: "lower_third", at: 1, duration: 2, text: "Hanoi", style: { position: "top" } }, "lower_third");
    expect(third.box.top).toBe(ZONE.top);
    const keyword = only({ kind: "keyword", at: 1, duration: 2, text: "3x", style: { position: "bottom", entrance: "type", typing_speed: 10, colors: { card: "#ffffff" } } }, "keyword");
    expect(keyword).toMatchObject({ entrance: "type", typing: 10, colors: { card: "#ffffff" } });
  });

  it("keeps a hook title on across cuts and beside another overlay, but refuses what sits on it", () => {
    expect(problems([HOOK, { kind: "keyword", at: 1, duration: 2, text: "3x" }, COUNTER, PLACE, DATE])).toEqual([]);
    expect(problems([{ ...HOOK, duration: 25 }, { ...HOOK, at: 21, duration: 2 }])).toEqual([
      "overlays[1]: starts at 21 s while the hook title overlays[0] is on screen (until 25 s); one hook title at a time",
    ]);
    expect(problems([HOOK, { kind: "keyword", at: 1, duration: 2, text: "3x", style: { position: "top" } }])).toEqual([
      "overlays[1]: the keyword would sit on the hook title overlays[0] (on screen until 15 s); move it lower or start it after the title",
    ]);
    expect(problems([HOOK, { kind: "date_stamp", at: 1, duration: 2, text: "Day 1" }])).toEqual([
      "overlays[1]: the date stamp would sit on the hook title overlays[0] (on screen until 15 s); move it lower or start it after the title",
    ]);
    // A punch-in draws nothing, so it may play under a hook title.
    expect(problems([HOOK, { kind: "punch_in", at: 2, duration: 1 }])).toEqual([]);
    expect(problems([{ ...HOOK, duration: 31 }])).toEqual(["overlays[0]: ends at 31 s, past the cut's end (30 s)"]);
  });

  it("keeps a search bar on across a jump cut of one shot, and refuses text too wide or too tall for its card", () => {
    expect(problems([{ ...SEARCH, at: 9 }])).toEqual([]);
    expect(problems([{ ...SEARCH, text: "x".repeat(40), style: { size: "l" } }])).toEqual(["overlays[0]: the search bar's query is too wide for one line; shorten it or use a smaller size"]);
    expect(problems([{ ...COUNTER, value: 999_999_999, unit: "kilometres", style: { size: "l" } }])).toEqual([
      "overlays[0]: the counter's number is too wide for one line; shorten it or use a smaller size",
    ]);
    expect(problems([{ ...HOOK, text: "x ".repeat(32).trim(), style: { size: "l" } }])).toEqual(["overlays[0]: the hook title takes more than 2 lines even at a smaller size; shorten it or use a smaller size"]);
    expect(problems([{ ...HOOK, text: "x".repeat(40) }])).toEqual(["overlays[0]: the hook title takes more than 2 lines even at a smaller size; shorten it or use a smaller size"]);
    expect(problems([{ ...HOOK, text: "Why?", place: "W".repeat(40), style: { size: "l" } }])).toEqual(["overlays[0]: the hook title's place label is too wide for one line; shorten it or use a smaller size"]);
    expect(problems([{ ...PLACE, subtitle: "W".repeat(40), style: { size: "l" } }])).toEqual(["overlays[0]: the place card's subtitle is too wide for one line; shorten it or use a smaller size"]);
    const narrow = { frame: { width: 300, height: 960 }, film: { ...film, format: "16:9" as const }, caption: { top: 700, left: 40, right: 40, fontSize: 32 } };
    expect(problems([{ ...DATE, text: "W".repeat(24), style: { size: "l" } }], narrow)).toEqual(["overlays[0]: the date stamp's text is too wide for one line; shorten it or use a smaller size"]);
    expect(problems([{ ...DATE, text: "D", place: "W".repeat(40), style: { size: "l" } }], narrow)).toEqual(["overlays[0]: the date stamp's place is too wide for one line; shorten it or use a smaller size"]);
    const low = { frame: { width: 1080, height: 500 }, film: { ...film, format: "16:9" as const }, caption: { top: 300, left: 80, right: 80, fontSize: 64 } };
    expect(problems([{ ...PLACE, style: { size: "l" } }], low)).toEqual([
      expect.stringMatching(/^overlays\[0\]: the place card \(\d+ px tall\) does not fit between the platform safe zone and the captions; use a smaller size or shorter text$/),
    ]);
  });

  it("names each drawn overlay's bounds and its texts by font role", () => {
    const all = resolved([HOOK, COUNTER, PLACE, DATE, { kind: "arrow", at: 11, duration: 1, anchor: { x: 800, y: 900 } }, { kind: "punch_in", at: 13, duration: 1 }]);
    const arrow = all.find((overlay) => overlay.kind === "arrow");
    expect(arrow === undefined ? null : getOverlayBounds(arrow)).toEqual({ left: 580, top: 720, width: 220, height: 180 });
    expect(getOverlayBounds(all.find((overlay) => overlay.kind === "punch_in") as ResolvedOverlay)).toBeNull();
    const texts = getOverlayTextsByRole([...all, ...resolved([SEARCH, { kind: "list", at: 25, duration: 2, items: ["a", "b"] }, { kind: "lower_third", at: 28, duration: 1, text: "Hue" }])], "pl-PL");
    expect(texts.heading).toEqual(["How much does a week", "in Vietnam cost?", "1250", "0123456789", "km", "Ha Long Bay"]);
    expect(texts.interface).toEqual(["Hanoi, Vietnam", "A bay of 1600 islands", "Day 12", "Hoi An", "cheap stay Hanoi", "a", "b", "Hue"]);
    expect(getOverlayTexts(resolved([{ ...COUNTER, unit: undefined }, { kind: "place_card", at: 21, duration: 2, text: "Hue" }, { kind: "date_stamp", at: 25, duration: 2, text: "D" }]))).toEqual([
      "1,250",
      "0123456789",
      "Hue",
      "D",
    ]);
  });
});

function composeInput(overlays: ResolvedOverlay[], fonts: FootageComposeInput["fonts"] = { heading: null, body: null }): FootageComposeInput {
  return {
    film,
    edl: edlWith([]),
    words: WORDS,
    frame: FRAME,
    caption: CAPTION,
    headlineSize: 96,
    colors: COLORS,
    fonts,
    assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "pl-PL",
    overlays,
  };
}

describe("the render's new kinds", () => {
  const face = (family: string, src: string) => ({ family, fallback: "sans-serif", faces: [{ src, weight: "700", style: "normal" as const, unicodeRange: null }] });

  it("writes the counter's locale into its script only as a canonical tag, so a brand's locale cannot close the script", () => {
    expect(getScriptLocale("pl-pl")).toBe("pl-PL");
    expect(getScriptLocale(undefined)).toBe("en-US");
    expect(getScriptLocale('en"});</script><script>alert(1)//')).toBe("en-US");
    const html = composeFootage({ ...composeInput(resolved([COUNTER]), { heading: null, body: face("Ral", "assets/fonts/1.ttf") }), locale: "pl-pl" });
    expect(html).toContain('new Intl.NumberFormat("pl-PL", {');
  });


  it("draws the hook title with its pin, the search field, the place card, the counter and the stamp in the brand's look", () => {
    const html = composeFootage(composeInput(resolved([HOOK, SEARCH, COUNTER, PLACE, DATE]), { heading: face("Cal", "assets/fonts/0.ttf"), body: face("Ral", "assets/fonts/1.ttf"), interface: face("Ui", "assets/fonts/2.ttf") }));
    expect(html).toContain('<div id="ov0" class="clip ov ov-hook-title center" data-start="0" data-duration="15"');
    expect(html).toContain('<svg class="ov-pin" viewBox="0 0 24 24"><path fill="#e8336b"');
    expect(html).toContain("<span>Hanoi, Vietnam</span></div><div class=\"ov-line\">How much does a week</div><div class=\"ov-line\">in Vietnam cost?</div>");
    expect(html).toContain('class="clip ov ov-search-bar center ty"');
    expect(html).toContain('<span class="ch">c</span><span class="ch">h</span>');
    expect(html).toContain('<span class="ch">&#32;</span>');
    expect(html).toContain('tl.to("#ov1 .ch", { opacity: 1, display: "inline", duration: 0.01, ease: "none", stagger: 0.071 }, 1.3);');
    expect(html).toContain('<span id="ov2n">0</span><span class="ov-unit" style="font-size:54px">km</span>');
    expect(html).toContain('new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })');
    expect(html).toContain("tl.fromTo(n, { v: 0 }, { v: 1250, duration: 1.5, ease: \"power2.out\"");
    expect(html).toContain('<div class="ov-sub" style="font-size:51px">A bay of 1600 islands</div>');
    expect(html).toContain('class="clip ov ov-date right"');
    expect(html).toContain('@font-face{font-family:"Ui"');
    expect(html).toContain('.ov-hook-title .ov-line{font-family:"Cal",sans-serif;');
    expect(html).toContain('font-family:"Ui",sans-serif;font-weight:700');
    // The hook title slides in, the place card too; the counter and the stamp fade; nothing bounces.
    expect(html).toContain('tl.fromTo("#ov0 .ov-card", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, 0);');
    expect(html).toContain('tl.fromTo("#ov2 .ov-card", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, 5);');
    expect(html).toContain('tl.fromTo("#ov1 .ov-card", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, 1);');
    expect(html).toContain('tl.to("#ov0 .ov-card", { y: 10, opacity: 0, duration: 0.3, ease: "power2.in" }, 14.7);');
    const newKinds = getOverlayMarkup(resolved([HOOK, SEARCH, COUNTER, PLACE, DATE]), { colors: COLORS, headingFont: "h", frame: FRAME }).tweens.join("\n");
    expect(newKinds).not.toContain("back.out");
  });

  it("takes each overlay's entrance, typing speed and colours", () => {
    const overlays = resolved([
      { kind: "keyword", at: 1, duration: 2, text: "3x", style: { entrance: "type", typing_speed: 10, colors: { card: "#ffffff", text: "#000000", accent: "#00ff00" } } },
      { kind: "lower_third", at: 11, duration: 2, text: "Hue", style: { entrance: "slide", colors: { accent: "#00ff00" } } },
      { kind: "list", at: 21, duration: 2, items: ["a", "b"], style: { entrance: "none", side: "left" } },
      { kind: "arrow", at: 25, duration: 2, anchor: { x: 800, y: 900 }, style: { entrance: "fade", colors: { accent: "#00ff00" } } },
      { kind: "highlight", at: 28, duration: 1.5, anchor: { x: 300, y: 500, width: 100, height: 100 }, style: { entrance: "none" } },
      { ...PLACE, at: 3.5, style: { entrance: "type" } },
      { ...DATE, at: 7, style: { entrance: "none", colors: { text: "#000000" } } },
      { ...SEARCH, at: 14, style: { entrance: "fade" } },
    ]);
    const { html, tweens } = getOverlayMarkup(overlays, { colors: COLORS, headingFont: "h", frame: FRAME });
    const all = `${html.join("\n")}\n${tweens.join("\n")}`;
    expect(all).toContain('<div class="ov-card" style="background:#ffffff;color:#000000;border-bottom-color:#00ff00"><span id="ov0t"><span class="ch">3</span><span class="ch">x</span></span></div>');
    expect(all).toContain('tl.to("#ov0 .ch", { opacity: 1, display: "inline", duration: 0.01, ease: "none", stagger: 0.1 }, 1.3);');
    expect(all).toContain('<i class="ov-dot" id="ov1d" style="background:#00ff00"></i>');
    expect(all).toContain('tl.fromTo("#ov1 .ov-card", { opacity: 0, y: 28 }');
    expect(all).not.toContain('"#ov1d", { scale: 0 }');
    expect(all).not.toContain('tl.fromTo("#ov2 .ov-card"');
    expect(all).not.toContain('"#ov2i0"');
    expect(all).toContain('stroke="#00ff00" stroke-width="10" stroke-linecap="round"/>');
    expect(all).toContain('tl.fromTo("#ov3 .ov-svg", { opacity: 0 }');
    expect(all).not.toContain('"#ov4s", { attr');
    expect(all).toContain('<div class="ov-line"><span class="ch">H</span>');
    expect(all).toContain('tl.to("#ov5 .ch", { opacity: 1, display: "inline", duration: 0.01, ease: "none", stagger: 0.071 }, 3.8);');
    expect(all).toContain('<div id="ov6" class="clip ov ov-date"');
    expect(all).toContain('<div class="ov-card" style="color:#000000">');
    expect(all).not.toContain('tl.fromTo("#ov6 .ov-card"');
    expect(all).toContain('<span id="ov7t">cheap stay Hanoi</span>');
    expect(all).toContain('tl.fromTo("#ov7 .ov-card", { opacity: 0 }, { opacity: 1, duration: 0.4');
    expect(getOverlayColors(overlays[0] as ResolvedOverlay, COLORS)).toEqual({ background: "#ffffff", foreground: "#000000", accent: "#00ff00" });
    expect(getOverlayColors({ index: 0, start: 0, end: 1, segment: 0, kind: "punch_in", scale: 1.1, ease: 0.3 }, COLORS)).toEqual({ background: COLORS.background, foreground: COLORS.foreground, accent: COLORS.accent });
  });

  it("times a count and a typed text", () => {
    expect(getCounterSeconds({ start: 5, end: 6 })).toEqual({ start: 5.15, duration: 0.6 });
    expect(getCounterSeconds({ start: 5, end: 13 })).toEqual({ start: 5.15, duration: 1.6 });
    expect(getTypingTimes(1, "abc", 10)).toEqual([1.3, 1.4, 1.5]);
  });
});

describe("the draft's new kinds", () => {
  const draft = (overlays: EdlOverlay[], extra: { overlayFonts?: { heading?: string; interface?: string }; locale?: string } = {}) =>
    (buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(overlays), overlayColors: COLORS, ...extra }) ?? "")
      .split("\n")
      .filter((line) => line.startsWith("Dialogue:") || line.startsWith("Style: OverlayPlain"));

  it("draws rounded cards with their text on layer 4, a pin and a magnifier in the accent", () => {
    const lines = draft([HOOK, SEARCH]);
    expect(lines[0]).toBe("Style: OverlayPlain,DejaVu Sans,48,&H00F2F7FD,&H00F2F7FD,&H00F2F7FD,&H00F2F7FD,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1");
    expect(lines[1]).toMatch(/^Dialogue: 3,0:00:00\.00,0:00:15\.00,OverlayShape,,0,0,0,,\{\\an7\\move\(0,28,0,0,0,300\)\\fad\(150,250\)\\1c&H2B1A1D&\\p1\}m \d+ \d+ l .* b .*\{\\p0\}$/);
    expect(lines[2]).toMatch(/^Dialogue: 4,.*OverlayShape.*\\1c&H6B33E8&\\p1\}m /);
    expect(lines[3]).toMatch(/^Dialogue: 4,0:00:00\.00,0:00:15\.00,OverlayPlain,,0,0,0,,\{\\an7\\fs35\\move\(\d+,\d+,\d+,\d+,0,300\)\\fad\(150,250\)\}Hanoi, Vietnam$/);
    expect(lines[4]).toMatch(/\\an8\\fs64\\move.*\}How much does a week$/);
    expect(lines[5]).toMatch(/\}in Vietnam cost\?$/);
    const search = lines.filter((line) => /^Dialogue: 4,0:00:0[1-4]/.test(line) && line.includes("\\an4"));
    expect(search[0]).toMatch(/^Dialogue: 4,0:00:01\.00,0:00:01\.30,OverlayPlain,,0,0,0,,\{\\an4\\fs42\\pos\(\d+,\d+\)\\fad\(150,0\)\}\{\\1a&HFF&\}cheap stay Hanoi$/);
    expect(search[1]).toMatch(/0:00:01\.30,0:00:01\.37,.*\}c\{\\1a&HFF&\}heap stay Hanoi$/);
    expect(search.at(-1)).toMatch(/0:00:02\.37,0:00:04\.00,.*\\fad\(0,250\)\}cheap stay Hanoi$/);
  });

  it("steps a counter up to its value, grouped as the locale writes it", () => {
    const lines = draft([{ ...COUNTER, value: 12500 }], { locale: "pl-PL" }).filter((line) => line.includes("\\an5"));
    expect(lines[0]).toMatch(/0:00:05\.00,0:00:05\.15,.*\}0\{\\fs54\} km$/);
    expect(lines.at(-1)).toMatch(/0:00:06\.55,0:00:08\.00,.*\}12 500\{\\fs54\} km$/);
    expect(lines).toHaveLength(16);
    const bare = draft([{ kind: "counter", at: 5, duration: 1, value: 3 }]).filter((line) => line.includes("\\an5"));
    expect(bare.at(-1)).toMatch(/\}3$/);
  });

  it("draws a place card, a stamp in its corner and a typed hook title line after line, in the role fonts", () => {
    const lines = draft([PLACE, DATE, { ...HOOK, place: undefined, style: { entrance: "type", typing_speed: 40 } }], { overlayFonts: { heading: "Cal", interface: "Ui" } });
    expect(lines.some((line) => /\\an8\\fs92\\fnCal.*\}Ha Long Bay$/.test(line))).toBe(true);
    expect(lines.some((line) => /\\an8\\fs51\\fnUi.*\}A bay of 1600 islands$/.test(line))).toBe(true);
    expect(lines.some((line) => /\\an9\\fs36\\fnUi.*\}Day 12$/.test(line))).toBe(true);
    expect(lines.some((line) => /\\an9\\fs28\\fnUi.*\}Hoi An$/.test(line))).toBe(true);
    const second = lines.filter((line) => /\\an8\\fs64\\fnCal\\pos\(\d+,316\)/.test(line));
    // The second line types after the first line's 20 characters, centred: each step shows only what is typed (RV-131).
    expect(second[0]).toMatch(/^Dialogue: 4,0:00:00\.80,0:00:00\.83,.*\}i$/);
    expect(second.at(-1)).toMatch(/^Dialogue: 4,0:00:01\.18,0:00:15\.00,.*\}in Vietnam cost\?$/);
    expect(lines.some((line) => line.includes("\\1a&HFF&"))).toBe(false);
  });

  it("takes each overlay's entrance and colours on the drawn cards and the marks", () => {
    const lines = draft([
      { kind: "keyword", at: 1, duration: 2, text: "3x", style: { entrance: "type", colors: { card: "#ffffff", text: "#000000" } } },
      { kind: "lower_third", at: 11, duration: 2, text: "Hue", style: { entrance: "slide" } },
      { kind: "list", at: 21, duration: 2, items: ["a", "b"], style: { entrance: "none", side: "left" } },
      { kind: "arrow", at: 25, duration: 2, anchor: { x: 800, y: 900 }, style: { entrance: "none", colors: { accent: "#00ff00" } } },
      { kind: "highlight", at: 28, duration: 1.5, anchor: { x: 300, y: 500, width: 100, height: 100 } },
      { ...DATE, at: 7, style: { entrance: "none", colors: { text: "#000000" } } },
    ]).filter((line) => line.startsWith("Dialogue:"));
    // The typed keyword: its card in its own colour for the whole span, its text typing in over it.
    expect(lines[0]).toBe("Dialogue: 3,0:00:01.00,0:00:03.00,OverlayShape,,0,0,0,,{\\an7\\pos(0,0)\\fad(150,250)\\1c&HFFFFFF&\\p1}m 776 571 l 901 571 b 920 571 936 587 936 606 l 936 691 b 936 710 920 726 901 726 l 776 726 b 757 726 741 710 741 691 l 741 606 b 741 587 757 571 776 571{\\p0}");
    expect(lines[1]).toBe("Dialogue: 4,0:00:01.00,0:00:01.30,OverlayPlain,,0,0,0,,{\\an9\\fs84\\1c&H000000&\\pos(886,600)\\fad(150,0)}{\\1a&HFF&}3x");
    // The sliding lower third moves its card and its text together.
    expect(lines).toContain("Dialogue: 3,0:00:11.00,0:00:13.00,OverlayShape,,0,0,0,,{\\an7\\move(0,28,0,0,0,300)\\fad(150,250)\\1c&H2B1A1D&\\p1}m 106 1196 l 212 1196 b 224 1196 234 1206 234 1218 l 234 1270 b 234 1282 224 1292 212 1292 l 106 1292 b 94 1292 84 1282 84 1270 l 84 1218 b 84 1206 94 1196 106 1196{\\p0}");
    expect(lines).toContain("Dialogue: 4,0:00:11.00,0:00:13.00,OverlayPlain,,0,0,0,,{\\an1\\fs52\\move(115,1302,115,1274,0,300)\\fad(150,250)}Hue");
    // A list without an entrance only fades out.
    expect(lines).toContain("Dialogue: 4,0:00:21.00,0:00:23.00,OverlayPlain,,0,0,0,,{\\an7\\fs48\\pos(113,404)\\fad(0,250)}• a");
    expect(lines).toContain("Dialogue: 4,0:00:21.00,0:00:23.00,OverlayPlain,,0,0,0,,{\\an7\\fs48\\pos(113,471)\\fad(0,250)}• b");
    expect(lines.some((line) => line.startsWith("Dialogue: 3,0:00:25.00,0:00:27.00,OverlayShape,,0,0,0,,{\\an7\\pos(0,0)\\fad(0,250)\\1c&H00FF00&\\p1}"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Dialogue: 3,0:00:28.00,0:00:29.50,OverlayShape,,0,0,0,,{\\an7\\pos(0,0)\\fad(150,250)\\1a&HFF&\\3c&H6B33E8&"))).toBe(true);
    expect(lines.some((line) => /\\an7\\fs36\\1c&H000000&\\pos\(\d+,\d+\)\\fad\(0,250\)\}Day 12$/.test(line))).toBe(true);
  });

  it("draws rounded rectangles, pins and magnifiers as closed shapes", () => {
    expect(getRoundedRectDrawing({ left: 0, top: 0, width: 100, height: 40 }, 10)).toBe("m 10 0 l 90 0 b 96 0 100 4 100 10 l 100 30 b 100 36 96 40 90 40 l 10 40 b 4 40 0 36 0 30 l 0 10 b 0 4 4 0 10 0");
    expect(getPinDrawing({ x: 0, y: 0 }, 24)).toMatch(/^m 12 23 b .* m 12 6 b /);
    expect(getGlassDrawing({ x: 0, y: 0 }, 24).match(/m /g)).toHaveLength(3);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the new kinds burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grabFrame(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "overlay-kinds-")) : dir;
    const ass = buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(overlays), overlayColors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=20:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  const pixel = (frame: Buffer, x: number, y: number): number[] => {
    const at = (Math.round(y) * FRAME.width + Math.round(x)) * 3;
    return [frame[at] ?? 0, frame[at + 1] ?? 0, frame[at + 2] ?? 0];
  };
  const isNear = (rgb: number[], hex: string): boolean => [1, 3, 5].every((offset, channel) => Math.abs((rgb[channel] ?? 0) - parseInt(hex.slice(offset, offset + 2), 16)) <= 40);

  it("draws the hook title's card at the top and the search field's card, the frame bare around and after them", () => {
    const hook = only(HOOK, "hook_title");
    const search = only({ ...SEARCH, at: 6 }, "search_bar");
    const frame = grabFrame([HOOK, { ...SEARCH, at: 6 }], 7);
    expect(isNear(pixel(frame, hook.box.left + 40, hook.box.top + hook.box.height - 4), COLORS.background)).toBe(true);
    expect(isNear(pixel(frame, hook.box.left + hook.box.width / 2, hook.box.top - 10), "#3366aa")).toBe(true);
    // The field's rounded end: its middle row is the card, its corner the footage.
    expect(isNear(pixel(frame, search.box.left + search.box.width - 6, search.box.top + search.box.height / 2), COLORS.background)).toBe(true);
    expect(isNear(pixel(frame, search.box.left + 2, search.box.top + 2), "#3366aa")).toBe(true);
    const after = grabFrame([HOOK, { ...SEARCH, at: 6 }], 16);
    expect(isNear(pixel(after, hook.box.left + 40, hook.box.top + hook.box.height - 4), "#3366aa")).toBe(true);
  });
});
