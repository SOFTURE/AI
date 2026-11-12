import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "./compose.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { HAND_FONT } from "./hand-font.js";
import { getOverlayMarkup } from "./overlay-html.js";
import { DROP_FROM_EM, DROP_LETTER_GAP, DROP_LETTER_SECONDS, getDropLetterTimes, getDropLetterTurns, getDropOffsetAt } from "./overlay-motion.js";
import { isTypedOverlay, type EdlOverlay } from "./overlay-schema.js";
import {
  getNoteColors,
  getNoteTextBox,
  getNoteTickPoints,
  getNoteWordsByLine,
  getOverlayTextsByRole,
  getTornEdge,
  isHandFontNeeded,
  isTitleBand,
  resolveEdlOverlays,
  timeNote,
  wrapNoteText,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
} from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** The text devices: a handwritten note card, a torn strip, an end word, a highlight backdrop and the drop entrance. */

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

const WORDS = [
  { text: "Three", start: 1.1, end: 1.4 },
  { text: "nights", start: 1.45, end: 1.8 },
  { text: "cost", start: 1.9, end: 2.2 },
  { text: "forty", start: 2.3, end: 2.6 },
  { text: "dollars.", start: 2.65, end: 3.1 },
];
const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };

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

const NOTE: EdlOverlay = { kind: "note", at: 1, duration: 4, text: "Three nights cost forty dollars", style: { tick: true } };
const STRIP: EdlOverlay = { kind: "note", at: 11, duration: 3, text: "Book early", style: { note_style: "strip", side: "right" } };
const END: EdlOverlay = { kind: "end_word", at: 21, duration: 1.2, text: "Worth it" };
const MARKED: EdlOverlay = { kind: "keyword", at: 6, duration: 2, text: "3x", style: { backdrop: "highlight", entrance: "type" } };
const DROPPED: EdlOverlay = { kind: "hook_title", at: 25, duration: 3, text: "One week in Hanoi", style: { backdrop: "highlight", entrance: "drop" } };

const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: WORDS, frame: FRAME, caption: CAPTION, ...changes });
}

function resolved(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}): ResolvedOverlay[] {
  const result = resolve(overlays, changes);
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

function problems(overlays: EdlOverlay[]): string[] {
  const result = resolve(overlays);
  return result.ok ? [] : result.problems;
}

function only<K extends ResolvedOverlay["kind"]>(overlay: EdlOverlay, kind: K, changes: Partial<ResolveOverlaysInput> = {}): Extract<ResolvedOverlay, { kind: K }> {
  const [first] = resolved([overlay], changes);
  if (first?.kind !== kind) throw new Error(`expected a ${kind}`);
  return first as Extract<ResolvedOverlay, { kind: K }>;
}

describe("the text devices' schema", () => {
  const read = (overlay: object) => readEdl({ version: 2, film: "trip", segments: SEGMENTS, overlays: [overlay] });
  const error = (overlay: object) => {
    const result = read(overlay);
    return result.ok ? "" : result.error;
  };

  it("reads a note card and strip, an end word, a backdrop and the drop entrance", () => {
    for (const overlay of [
      NOTE,
      STRIP,
      { ...NOTE, style: { note_style: "card", side: "right", position: "middle", size: "s", entrance: "fade", colors: { card: "#ffffff", text: "#000000", accent: "#00ff00" } } },
      { ...STRIP, style: { note_style: "strip", typing_speed: 20, tick: true, entrance: "pop" } },
      END,
      { ...END, duration: 0.5, style: { entrance: "pop", size: "l", colors: { text: "#ffd400" } } },
      { ...END, duration: 2 },
      MARKED,
      DROPPED,
      { kind: "keyword", at: 1, duration: 2, text: "3x", style: { backdrop: "card", underline: true, entrance: "drop" } },
      { kind: "hook_title", at: 0, duration: 4, text: "Why Asia?", style: { backdrop: "card" } },
    ]) {
      expect(read(overlay).ok, JSON.stringify(overlay)).toBe(true);
    }
  });

  it("refuses an end word too short, too long or too wordy, and a note too long or too short", () => {
    expect(error({ ...END, duration: 0.4 })).toBe("overlays.0.duration: Too small: expected number to be >=0.5");
    expect(error({ ...END, duration: 2.1 })).toBe("overlays.0.duration: an end_word stays 0.5 to 2 s");
    expect(error({ ...END, text: "x".repeat(17) })).toBe("overlays.0.text: is longer than 16 characters");
    expect(error({ kind: "end_word", at: 21, duration: 1 })).toBe("overlays.0.text: an end_word needs its text");
    expect(error({ ...NOTE, text: "x".repeat(73) })).toBe("overlays.0.text: is longer than 72 characters");
    expect(error({ ...NOTE, duration: 0.9 })).toBe("overlays.0.duration: a note stays at least 1 s (only an end_word stays shorter)");
    expect(error({ ...NOTE, duration: 9 })).toBe("overlays.0.duration: a note stays at most 8 s (only a hook_title stays longer)");
    expect(error({ ...NOTE, place: "Hanoi" })).toBe("overlays.0.place: a note has no place label; leave it out");
  });

  it("refuses a knob a kind does not take", () => {
    expect(error({ kind: "lower_third", at: 1, duration: 2, text: "Hue", style: { backdrop: "highlight" } })).toBe("overlays.0.style.backdrop: only a hook_title or a keyword takes a backdrop; leave it out");
    expect(error({ ...MARKED, style: { backdrop: "highlight", underline: true } })).toBe("overlays.0.style.backdrop: a highlighted keyword draws no underline; give backdrop highlight or underline, not both");
    expect(error({ ...MARKED, style: { note_style: "strip" } })).toBe("overlays.0.style.note_style: only a note has a note_style; leave it out");
    expect(error({ ...END, style: { tick: true } })).toBe("overlays.0.style.tick: only a note draws a tick; leave it out");
    expect(error({ ...NOTE, style: { position: "bottom" } })).toBe("overlays.0.style.position: a note sits at top, middle");
    expect(error({ ...NOTE, style: { entrance: "drop" } })).toBe("overlays.0.style.entrance: a note enters by fade, pop, none");
    expect(error({ ...END, style: { entrance: "type" } })).toBe("overlays.0.style.entrance: an end_word enters by drop, pop, fade, rise, none");
    expect(error({ ...END, style: { side: "left" } })).toBe("overlays.0.style.side: an end_word has no side; leave it out");
    expect(error({ ...NOTE, style: { typing_speed: 20 } })).toBe("overlays.0.style.typing_speed: only a typed entrance, a search bar or a note strip has a typing speed");
    expect(error({ ...MARKED, style: { backdrop: "neon" } })).toContain("overlays.0.style.backdrop");
  });

  it("types a note strip, never a note card", () => {
    expect(isTypedOverlay({ kind: "note", style: { note_style: "strip" } })).toBe(true);
    expect(isTypedOverlay({ kind: "note" })).toBe(false);
    expect(isTypedOverlay({ kind: "end_word", style: { entrance: "drop" } })).toBe(false);
  });
});

describe("the drop entrance's motion", () => {
  it("times each letter, spaces taking no turn", () => {
    // A space takes the next letter's time: it is drawn with it.
    expect(getDropLetterTimes(2, "ab c")).toEqual([2, 2.067, 2.134, 2.134]);
    expect(getDropLetterTimes(0, "")).toEqual([]);
    expect(getDropLetterTurns("abcd")).toEqual([-4, 6, -8, 5]);
    expect(getDropLetterTurns("x".repeat(20)).every((turn) => Math.abs(turn) <= 8)).toBe(true);
  });

  it("falls from above into place, never past its line and never back up", () => {
    const fontSize = 100;
    let lastY = -Infinity;
    let lastOpacity = 0;
    for (let step = 0; step <= 20; step++) {
      const at = getDropOffsetAt((step / 20) * DROP_LETTER_SECONDS * 1.5, { fontSize, turn: 8 });
      expect(at.y).toBeLessThanOrEqual(0);
      expect(at.y).toBeGreaterThanOrEqual(lastY);
      expect(at.opacity).toBeGreaterThanOrEqual(lastOpacity);
      expect(Math.abs(at.turn)).toBeLessThanOrEqual(8);
      lastY = at.y;
      lastOpacity = at.opacity;
    }
    expect(getDropOffsetAt(0, { fontSize, turn: 8 })).toEqual({ y: -DROP_FROM_EM * fontSize, turn: 8, opacity: 0 });
    expect(getDropOffsetAt(DROP_LETTER_SECONDS, { fontSize, turn: 8 })).toEqual({ y: 0, turn: 0, opacity: 1 });
    expect(getDropOffsetAt(-1, { fontSize, turn: -4 })).toEqual({ y: -DROP_FROM_EM * fontSize, turn: -4, opacity: 0 });
    expect(DROP_LETTER_GAP).toBe(0.067);
  });
});

describe("placing the text devices", () => {
  it("puts a note card on the left, tilted, its words on the words said and its tick after them", () => {
    const note = only(NOTE, "note");
    expect(note).toMatchObject({
      noteStyle: "card",
      lines: ["Three nights cost forty", "dollars"],
      fontSize: 56,
      side: "left",
      box: { left: 84, top: 220, width: 524, height: 191 },
      tilt: 3,
      wordTimes: [1.1, 1.45, 1.9, 2.3, 2.65],
      tick: true,
      tickAt: 2.8,
    });
    expect(note.tear).toHaveLength(14);
    expect(note.tear.every((depth) => depth >= 0.25 && depth <= 1)).toBe(true);
    expect(getNoteWordsByLine(note)).toEqual([
      [
        { text: "Three", at: 1.1 },
        { text: "nights", at: 1.45 },
        { text: "cost", at: 1.9 },
        { text: "forty", at: 2.3 },
      ],
      [{ text: "dollars", at: 2.65 }],
    ]);
  });

  it("puts a strip on its side in capitals, tilted the other way, typing its text", () => {
    const strip = only(STRIP, "note");
    expect(strip).toMatchObject({ noteStyle: "strip", lines: ["BOOK EARLY"], fontSize: 46, side: "right", box: { left: 536, top: 220, width: 400, height: 102 }, tilt: -2, wordTimes: null, tick: false, tickAt: null, typing: 14 });
    expect(getNoteTextBox(strip)).toMatchObject({ left: 561, top: 248, width: 350 });
    const ticked = only({ ...STRIP, style: { note_style: "strip", tick: true, typing_speed: 10 } }, "note");
    // 0.3 s before the first letter, nine letters after it at 10 a second, then the tick's delay.
    expect(ticked.tickAt).toBe(12.35);
  });

  it("places a note in the middle on request and refuses one that does not fit", () => {
    expect(only({ ...NOTE, style: { position: "middle" } }, "note").box.top).toBe(553);
    expect(problems([{ ...NOTE, text: "Supercalifragilisticexpialidocious" }])).toEqual(["overlays[0]: a word of the note is too wide for its card; shorten it or use a smaller size"]);
    expect(problems([{ ...NOTE, text: "Unforgettable sunsets, incredible people, delicious streetfood, cheap hos", style: { size: "l" } }])).toEqual([
      "overlays[0]: the note takes 5 lines, more than 4; shorten it or use a smaller size",
    ]);
    // The longest word that fits the card alone has no room left for the tick beside it.
    const fits = (text: string, tick: boolean) => problems([{ ...NOTE, text, style: { size: "l", tick } }]).length === 0;
    const longest = Array.from({ length: 30 }, (_value, length) => "a".repeat(length + 1)).filter((text) => fits(text, false)).at(-1) ?? "";
    expect(longest.length).toBeGreaterThan(10);
    expect(problems([{ ...NOTE, text: longest, style: { size: "l", tick: true } }])).toEqual([
      "overlays[0]: the note's last line and its tick are too wide for its card; shorten it or leave the tick out",
    ]);
  });

  it("times a note card's words when none, some or the same words are said", () => {
    const silent = only(NOTE, "note", { words: [] });
    expect(silent.wordTimes).toEqual([1.034, 1.384, 1.734, 2.084, 2.434]);
    const partly = only({ ...NOTE, text: "Three cheap nights" }, "note");
    // "cheap" is not said: it comes with the word before it.
    expect(partly.wordTimes).toEqual([1.1, 1.1, 1.45]);
    const late = only({ ...NOTE, at: 1, duration: 1.2 }, "note");
    // No word later than 0.6 s before the end, the tick in place before the last 0.4 s.
    expect(late.wordTimes).toEqual([1.1, 1.45, 1.6, 1.6, 1.6]);
    expect(late.tickAt).toBe(1.75);
    const reordered = only({ ...NOTE, text: "forty Three", style: {} }, "note");
    expect(reordered.wordTimes).toEqual([2.3, 2.3]);
    expect(reordered.tickAt).toBeNull();
  });

  it("times a note directly, as the resolver does", () => {
    const note = { ...only(NOTE, "note"), wordTimes: null, tickAt: null };
    expect(timeNote(note, [])).toEqual({ wordTimes: [1.034, 1.384, 1.734, 2.084, 2.434], tickAt: 2.584 });
    expect(timeNote({ ...note, tick: false }, WORDS)).toEqual({ wordTimes: [1.1, 1.45, 1.9, 2.3, 2.65], tickAt: null });
    expect(timeNote({ ...note, noteStyle: "strip", typing: null, lines: ["AB"] }, WORDS).wordTimes).toBeNull();
  });

  it("wraps a note's text and tears its edge the same way every time", () => {
    expect(wrapNoteText("a b c d e f g h", 40, 2000)).toEqual(["a b c d e f", "g h"]);
    expect(wrapNoteText("", 40, 200)).toEqual([]);
    expect(wrapNoteText("toolongforthecard", 80, 100)).toBeNull();
    expect(getTornEdge("Book early")).toEqual(getTornEdge("Book early"));
    expect(getTornEdge("Book early")).not.toEqual(getTornEdge("Book later"));
    expect(getTornEdge("x", 3)).toHaveLength(3);
  });

  it("puts an end word big and centred at the top, shrinking a long one, refusing one that never fits", () => {
    expect(only(END, "end_word")).toMatchObject({ text: "Worth it", fontSize: 150, box: { left: 275, top: 220, width: 470, height: 173 } });
    // Measured from the hand font itself: the longest end word the schema takes fits, a little smaller.
    expect(only({ ...END, text: "Worth every cent", style: { size: "l" } }, "end_word")).toMatchObject({ fontSize: 131, box: { left: 108, width: 804 } });
    expect(only({ ...END, text: "  See   you soon " }, "end_word").text).toBe("See you soon");
    expect(problems([{ ...END, text: "WWWWWWWWWWWWWWWW", style: { size: "l" } }])).toEqual([
      "overlays[0]: the end word is too wide for one line even at a smaller size; shorten it or use a smaller size",
    ]);
  });

  it("keeps one title at the top at a time and nothing on an end word", () => {
    expect(isTitleBand("end_word")).toBe(true);
    expect(isTitleBand("hook_title")).toBe(true);
    expect(isTitleBand("note")).toBe(false);
    expect(problems([{ kind: "hook_title", at: 20, duration: 3, text: "Hanoi" }, { ...END, at: 22 }])).toEqual([
      "overlays[1]: starts at 22 s while the hook title overlays[0] is on screen (until 23 s); one title at the top at a time",
    ]);
    expect(problems([{ ...END, duration: 2 }, { ...NOTE, at: 22, duration: 2 }])).toEqual([
      "overlays[1]: the note would sit on the end word overlays[0] (on screen until 23 s); move it lower or start it after the end word",
    ]);
    // An end word runs across a cut and beside a lower overlay.
    expect(problems([{ ...END, at: 9.5, duration: 1 }])).toEqual([]);
    expect(problems([{ ...END, duration: 2 }, { kind: "keyword", at: 21.5, duration: 1, text: "3x", style: { position: "bottom" } }])).toEqual([]);
  });

  it("passes the highlight backdrop through and names the hand font's texts", () => {
    const all = resolved([MARKED, NOTE, STRIP, END]);
    const [note, keyword, strip, end] = all;
    expect(keyword).toMatchObject({ kind: "keyword", backdrop: "highlight" });
    expect(only({ ...MARKED, style: { backdrop: "card" } }, "keyword")).not.toHaveProperty("backdrop");
    const texts = getOverlayTextsByRole([keyword, note, strip, end] as ResolvedOverlay[]);
    expect(texts.heading).toEqual(["3x", "BOOK EARLY"]);
    expect(isHandFontNeeded([note as ResolvedOverlay])).toBe(true);
    expect(isHandFontNeeded([end as ResolvedOverlay])).toBe(true);
    expect(isHandFontNeeded([strip as ResolvedOverlay, keyword as ResolvedOverlay])).toBe(false);
    expect(getNoteColors(note as Extract<ResolvedOverlay, { kind: "note" }>)).toEqual({ paper: "#fbf8f1", ink: "#1d1f24", tick: "#2f9e4f" });
    expect(getNoteColors({ ...(note as Extract<ResolvedOverlay, { kind: "note" }>), colors: { card: "#ffffff", text: "#000000", accent: "#00ff00" } })).toEqual({ paper: "#ffffff", ink: "#000000", tick: "#00ff00" });
    expect(getNoteTickPoints(note as Extract<ResolvedOverlay, { kind: "note" }>)).toHaveLength(3);
  });
});

describe("the render's text devices", () => {
  const markup = (overlays: EdlOverlay[]) => {
    const { html, css, tweens } = getOverlayMarkup(resolved(overlays), { colors: COLORS, headingFont: "h", frame: FRAME });
    return { html: html.join("\n"), css: css.join("\n"), tweens: tweens.join("\n") };
  };

  it("draws a note card on paper, its words fading in as they are said and its tick drawn after", () => {
    const { html, css, tweens } = markup([NOTE]);
    expect(html).toContain('<div id="ov0" class="clip ov ov-note ov-hand" data-start="1" data-duration="4" style="left:84px;top:220px;width:524px;height:191px;font-size:56px;color:#1d1f24;transform:rotate(-3deg)">');
    expect(html).toContain('<svg class="paper" viewBox="0 0 524 191"><polygon points="0,0 524,0 524,179.2 ');
    expect(html).toContain('fill="#fbf8f1"/></svg><div class="nt" style="left:31px;top:22px"><span class="nw" id="ov0w0">Three</span> <span class="nw" id="ov0w1">nights</span> <span class="nw" id="ov0w2">cost</span>');
    expect(html).toContain('<div class="nt" style="left:31px;top:89.2px"><span class="nw" id="ov0w4">dollars</span></div>');
    expect(html).toContain('<polyline id="ov0k" points="181,125.3 198.5,142.8 231,101.8" fill="none" stroke="#2f9e4f"');
    expect(css).toContain('@font-face{font-family:"Caveat";src:url("assets/fonts/hand.ttf") format("truetype");font-weight:400;font-style:normal}');
    expect(css).toContain('.ov-hand{font-family:"Caveat",cursive;font-weight:400}');
    expect(tweens).toContain('tl.fromTo("#ov0w0", { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, 1.1);');
    expect(tweens).toContain('tl.fromTo("#ov0w4", { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, 2.65);');
    expect(tweens).toContain('tl.fromTo("#ov0k", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out", immediateRender: false }, 2.8);');
    expect(tweens).toContain('tl.to("#ov0 .nb", { opacity: 0, duration: 0.3, ease: "power2.in" }, 4.7);');
    expect(tweens).not.toContain('"#ov0 .nb", { opacity: 0 }, { opacity: 1');
    const faded = markup([{ ...NOTE, style: { entrance: "fade" } }]).tweens;
    expect(faded).toContain('tl.fromTo("#ov0 .nb", { opacity: 0 }, { opacity: 1');
  });

  it("grows a strip in from its middle and types it in the heading font", () => {
    const { html, css, tweens } = markup([STRIP]);
    expect(html).toContain('<div id="ov0" class="clip ov ov-note ov-strip ty"');
    expect(html).toContain('transform:rotate(2deg)');
    expect(html).toContain('<span class="ch">B</span><span class="ch">O</span>');
    expect(css).toContain(".ov-strip .nt{font-family:h;font-weight:800;letter-spacing:.02em}");
    expect(css).not.toContain("@font-face");
    expect(tweens).toContain('tl.fromTo("#ov0 .nb", { scale: 0.3 }, { scale: 1, duration: 0.267, ease: "power2.out", immediateRender: false }, 11);');
    expect(tweens).toContain('tl.to("#ov0 .ch", { opacity: 1, display: "inline", duration: 0.01, ease: "none", stagger: 0.071 }, 11.3);');
    expect(markup([{ ...STRIP, style: { note_style: "strip", entrance: "none" } }]).tweens).not.toContain("scale: 0.3");
  });

  it("drops an end word's letters into place, white with a shadow, and takes its colour", () => {
    const { html, tweens } = markup([END]);
    expect(html).toContain('<div class="ov-endword ov-hand nb" style="color:#ffffff"><span class="dl">W</span><span class="dl">o</span>');
    expect(tweens).toContain('tl.fromTo("#ov0 .dl", { y: -45, rotation: (i) => [-4,6,-8,5,-7,4,-6][i] }, { y: 0, rotation: 0, duration: 0.3, ease: "power2.out", stagger: 0.067, immediateRender: false }, 21);');
    expect(tweens).toContain('tl.fromTo("#ov0 .dl", { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none", stagger: 0.067, immediateRender: false }, 21);');
    expect(tweens).not.toMatch(/back\.out|elastic|bounce/);
    const popped = markup([{ ...END, style: { entrance: "pop", colors: { text: "#ffd400" } } }]);
    expect(popped.html).toContain('style="color:#ffd400">Worth it</div>');
    expect(popped.tweens).toContain('tl.fromTo("#ov0 .nb", { opacity: 0, scale: 0.92 }');
  });

  it("marks a keyword and a hook title with a highlight behind each line instead of a card", () => {
    const { html, css, tweens } = markup([MARKED, DROPPED]);
    expect(html).toContain('<div class="ov-card hl"><span id="ov0t" class="ov-mark" style="background:#1d1a2b"><span class="ch">3</span><span class="ch">x</span></span></div>');
    expect(html).toContain('<div class="ov-line"><span class="ov-mark" id="ov1m0" style="background:#1d1a2b"><span class="dl">O</span>');
    // A typed mark waits for its first letter; a dropped title's marks stand from the start.
    expect(css).toContain(".ty .hl .ov-mark{display:none}");
    expect(tweens).toContain('tl.set("#ov0t", { display: "inline" }, 6.3);');
    expect(tweens.match(/display: "inline" \}, /g)).toHaveLength(1);
    expect(css).toContain(".ov .ov-card.hl{background:transparent;box-shadow:none;border:none}");
    expect(css).toContain(".ov-mark{padding:.04em .22em;border-radius:.14em;-webkit-box-decoration-break:clone;box-decoration-break:clone}");
    expect(tweens).toContain('tl.fromTo("#ov1 .dl", { y: -19.2, rotation: (i) => [-4,6,-8,5,-7,4,-6,8,-5,7,-4,6,-8,5][i] }');
    const plain = markup([{ ...MARKED, style: { backdrop: "highlight" } }]).html;
    expect(plain).toContain('<span id="ov0t" class="ov-mark" style="background:#1d1a2b">3x</span>');
    const dropped = markup([{ kind: "keyword", at: 1, duration: 2, text: "Go", style: { entrance: "drop" } }]);
    expect(dropped.html).toContain('<span class="dl">G</span><span class="dl">o</span>');
    expect(dropped.html).not.toContain("ov-mark");
  });

  it("shows each typed title line's mark with the line's first letter, never as an empty block", () => {
    const typed: EdlOverlay = { kind: "hook_title", at: 0, duration: 3, text: "How much is a week by the sea in Hanoi?", style: { backdrop: "highlight", entrance: "type", typing_speed: 20 } };
    const resolved = resolveEdlOverlays({ film, edl: edlWith([typed]), words: WORDS, frame: FRAME, caption: CAPTION });
    if (!resolved.ok) throw new Error(resolved.problems.join("; "));
    const title = resolved.overlays[0];
    if (title?.kind !== "hook_title") throw new Error("no hook title");
    const { html, tweens } = markup([typed]);
    expect(title.lines.length).toBeGreaterThan(1);
    expect(html).toContain('id="ov0m1"');
    const firstOfSecond = 0.3 + [...(title.lines[0] ?? "")].length / 20;
    expect(tweens).toContain('tl.set("#ov0m0", { display: "inline" }, 0.3);');
    expect(tweens).toContain(`tl.set("#ov0m1", { display: "inline" }, ${String(Math.round(firstOfSecond * 1000) / 1000)});`);
  });

  it("loads the hand font in the composed page only when a device needs it", () => {
    const input = (overlays: ResolvedOverlay[]): FootageComposeInput => ({
      film,
      edl: edlWith([]),
      words: WORDS,
      frame: FRAME,
      caption: CAPTION,
      headlineSize: 96,
      colors: COLORS,
      fonts: { heading: null, body: null },
      assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
      brandName: "Acme",
      locale: "pl-PL",
      overlays,
    });
    expect(composeFootage(input(resolved([END])))).toContain(`src:url("${HAND_FONT.asset}")`);
    expect(composeFootage(input(resolved([STRIP])))).not.toContain(`font-family:"${HAND_FONT.family}";src`);
    expect(getOverlayMarkup(resolved([NOTE]), { colors: COLORS, headingFont: "h", frame: FRAME, handFontSrc: "x/hand.ttf" }).css[0]).toContain('src:url("x/hand.ttf")');
  });
});

describe("the draft's text devices", () => {
  const draft = (overlays: EdlOverlay[], extra: { overlayFonts?: { heading?: string; interface?: string } } = {}) =>
    (buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(overlays), overlayColors: COLORS, ...extra }) ?? "")
      .split("\n")
      .filter((line) => line.startsWith("Dialogue:"));

  it("draws a note card's shadow and paper, its words fading in on their times and its tick drawn after them", () => {
    const lines = draft([NOTE]);
    expect(lines[0]).toMatch(/^Dialogue: 3,0:00:01\.00,0:00:05\.00,OverlayShape,,0,0,0,,\{\\an7\\pos\(0,0\)\\fad\(0,250\)\\org\(346,316\)\\frz3\\blur10\\1c&H000000&\\1a&HB0&\\p1\}m 84 226 l 608 226 /);
    expect(lines[1]).toMatch(/^Dialogue: 3,0:00:01\.00,0:00:05\.00,OverlayShape,.*\\frz3\\1c&HF1F8FB&\\p1\}m 84 220 l 608 220 /);
    expect(lines[2]).toBe(
      "Dialogue: 4,0:00:01.00,0:00:05.00,OverlayPlain,,0,0,0,,{\\an7\\fs72\\fnCaveat\\b0\\1c&H241F1D&\\org(346,316)\\frz3\\pos(115,242)\\fad(0,250)}{\\alpha&HFF&\\t(100,200,\\alpha&H00&)}Three {\\alpha&HFF&\\t(450,550,\\alpha&H00&)}nights {\\alpha&HFF&\\t(900,1000,\\alpha&H00&)}cost {\\alpha&HFF&\\t(1300,1400,\\alpha&H00&)}forty",
    );
    expect(lines[3]).toMatch(/\}\{\\alpha&HFF&\\t\(1650,1750,\\alpha&H00&\)\}dollars$/);
    expect(lines[4]).toMatch(/^Dialogue: 4,0:00:02\.80,0:00:05\.00,OverlayShape,.*\\clip\(254,311,254,374\)\\t\(0,300,\\clip\(254,311,326,374\)\).*\\1c&H4F9E2F&\\p1\}m 260 345 /);
    expect(lines).toHaveLength(5);
  });

  it("grows a strip in and types it, in the heading font when the brand has one", () => {
    const lines = draft([STRIP], { overlayFonts: { heading: "Cal" } });
    expect(lines[0]).toMatch(/\\move\(515,190,0,0,0,267\)\\fad\(187,250\)\\fscx30\\fscy30\\t\(0,267,\\fscx100\\fscy100\)\\org\(736,271\)\\frz-2\\blur10/);
    expect(lines[2]).toBe("Dialogue: 4,0:00:11.00,0:00:11.30,OverlayPlain,,0,0,0,,{\\an7\\fs46\\fnCal\\b1\\1c&H241F1D&\\org(736,271)\\frz-2\\pos(561,248)}{\\1a&HFF&}BOOK EARLY");
    expect(lines.at(-1)).toBe("Dialogue: 4,0:00:11.94,0:00:14.00,OverlayPlain,,0,0,0,,{\\an7\\fs46\\fnCal\\b1\\1c&H241F1D&\\org(736,271)\\frz-2\\pos(561,248)\\fad(0,250)}BOOK EARLY");
    expect(draft([{ ...STRIP, style: { note_style: "strip", entrance: "none" } }])[0]).not.toContain("\\fscx30");
  });

  it("brings an end word's letters in one by one, handwritten and white", () => {
    const [line] = draft([END]);
    expect(line).toBe(
      "Dialogue: 4,0:00:21.00,0:00:22.20,OverlayPlain,,0,0,0,,{\\an8\\fs193\\fnCaveat\\b0\\1c&HFFFFFF&\\shad3\\4c&H000000&\\4a&H90&\\pos(510,220)\\fad(0,250)}{\\alpha&HFF&\\t(0,150,\\alpha&H00&)}W{\\alpha&HFF&\\t(67,217,\\alpha&H00&)}o{\\alpha&HFF&\\t(134,284,\\alpha&H00&)}r{\\alpha&HFF&\\t(201,351,\\alpha&H00&)}t{\\alpha&HFF&\\t(268,418,\\alpha&H00&)}h {\\alpha&HFF&\\t(335,485,\\alpha&H00&)}i{\\alpha&HFF&\\t(402,552,\\alpha&H00&)}t",
    );
    const [faded] = draft([{ ...END, style: { entrance: "fade" } }]);
    expect(faded).toMatch(/\\fad\(\d+,250\)\}Worth it$/);
  });

  it("draws a highlight mark that widens with each typed letter, and one under each dropped title line", () => {
    const lines = draft([MARKED, DROPPED]);
    const marks = lines.filter((line) => line.startsWith("Dialogue: 3,") && line.includes("\\1c&H2B1A1D&"));
    expect(marks[0]).toMatch(/^Dialogue: 3,0:00:06\.30,0:00:06\.37,.*\}m 831 597 l 893 597 /);
    expect(marks[1]).toMatch(/^Dialogue: 3,0:00:06\.37,0:00:08\.00,.*\}m 784 597 l 893 597 /);
    expect(marks[2]).toMatch(/^Dialogue: 3,0:00:25\.00,0:00:28\.00,.*\}m 200 240 l 820 240 /);
    expect(lines.some((line) => line.includes("\\an8\\fs64\\pos(510,242)") && line.includes("{\\alpha&HFF&\\t(0,150,\\alpha&H00&)}O"))).toBe(true);
    expect(lines.some((line) => line.includes("OverlayShape") && line.includes("m 167 "))).toBe(false);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("the text devices burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grabFrame(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "text-cards-")) : dir;
    const ass = buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: resolved(overlays), overlayColors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    for (const file of [FOOTAGE_DRAFT_FONT.file, HAND_FONT.file]) copyFileSync(file, join(dir, "fonts", basename(file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=30:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
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
  const countNear = (frame: Buffer, box: { left: number; top: number; width: number; height: number }, hex: string): number => {
    let count = 0;
    for (let y = box.top; y < box.top + box.height; y += 2) for (let x = box.left; x < box.left + box.width; x += 2) if (isNear(pixel(frame, x, y), hex)) count++;
    return count;
  };

  it("draws the note's paper with ink on it, and only the words said so far", () => {
    const note = only(NOTE, "note");
    const centre = { x: note.box.left + note.box.width / 2, y: note.box.top + note.box.height / 2 };
    const early = grabFrame([NOTE], 1.05);
    expect(isNear(pixel(early, centre.x, centre.y), "#fbf8f1")).toBe(true);
    expect(countNear(early, note.box, "#1d1f24")).toBe(0);
    const late = grabFrame([NOTE], 3.5);
    expect(countNear(late, note.box, "#1d1f24")).toBeGreaterThan(200);
    expect(countNear(late, note.box, "#2f9e4f")).toBeGreaterThan(20);
    expect(isNear(pixel(late, note.box.left + note.box.width + 30, centre.y), "#3366aa")).toBe(true);
  });

  it("draws the end word in white at the top, and the highlight mark behind the keyword", () => {
    const end = only(END, "end_word");
    const frame = grabFrame([END], 22);
    expect(countNear(frame, end.box, "#ffffff")).toBeGreaterThan(300);
    const keyword = only(MARKED, "keyword");
    const marked = grabFrame([MARKED], 7.5);
    expect(countNear(marked, keyword.box, COLORS.background)).toBeGreaterThan(300);
    expect(isNear(pixel(marked, keyword.box.left + 20, keyword.box.top + keyword.box.height / 2), "#3366aa")).toBe(true);
  });
});
