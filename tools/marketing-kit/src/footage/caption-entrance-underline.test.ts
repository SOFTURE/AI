import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { CAPTION_HIGHLIGHT_SECONDS, CAPTION_POP_FROM_SCALE, getCaptionEntranceTween, getCaptionHighlight } from "./caption-highlight.js";
import { composeFootage, type FootageComposeInput } from "./compose.js";
import { buildFootageDraftCaptions } from "./draft.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";

/** The caption pill's entrance (`captionEntrance`) and the underlined lit word (`captionHighlightStyle: "underline"`). */

const COLORS = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#111111",
  captionText: "#ffffff",
  captionHighlight: "#ff8a00",
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
  captionHighlightStyle: "underline",
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
const STYLE = { cornerRadius: "m", padding: "m", shadow: "none", border: "none" } as const;
/** A measure where every character is half a font size wide, so word places are exact. */
const measure = (line: string, size: number): number => line.length * size * 0.5;

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

describe("getCaptionEntranceTween", () => {
  it("keeps the rise and fade without an entrance", () => {
    expect(getCaptionEntranceTween(undefined)).toEqual({ from: { y: 14, opacity: 0 }, to: { y: 0, opacity: 1, duration: 0.16, ease: "power3.out" } });
  });

  it("enters at once with none, fades with fade and grows from 96 % to exactly 100 % with pop", () => {
    expect(getCaptionEntranceTween("none")).toBeNull();
    expect(getCaptionEntranceTween("fade")).toEqual({ from: { opacity: 0 }, to: { opacity: 1, duration: 0.16, ease: "power1.out" } });
    const pop = getCaptionEntranceTween("pop");
    expect(pop).toEqual({ from: { scale: CAPTION_POP_FROM_SCALE, opacity: 0 }, to: { scale: 1, opacity: 1, duration: 0.16, ease: "power2.out" } });
    expect(CAPTION_POP_FROM_SCALE).toBe(0.96);
  });

  it("never lets pop pass 100 %: its ease is one that ends at its target, not a back or elastic one", () => {
    const ease = getCaptionEntranceTween("pop")?.to.ease;
    expect(typeof ease === "string" && /back|elastic|bounce/i.test(ease)).toBe(false);
    expect(getCaptionEntranceTween("pop")?.to.scale).toBe(1);
  });
});

describe("composeFootage with a caption entrance", () => {
  const pillTween = (html: string): string | undefined => html.split("\n").find((line) => line.includes('tl.fromTo("#cap" + i + " .pill"'));

  it("writes the rise without an entrance, as before", () => {
    const plain: FootageFilm = { ...film, captionHighlightStyle: "text" };
    expect(pillTween(composeFootage(composeInput({ film: plain })))).toBe('  tl.fromTo("#cap" + i + " .pill", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: "power3.out" }, Math.max(0, words[0] - 0.05));');
  });

  it("writes the fade and the pop, and no pill tween for none", () => {
    expect(pillTween(composeFootage(composeInput({ film: { ...film, captionEntrance: "fade" } })))).toBe('  tl.fromTo("#cap" + i + " .pill", { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "power1.out" }, Math.max(0, words[0] - 0.05));');
    expect(pillTween(composeFootage(composeInput({ film: { ...film, captionEntrance: "pop" } })))).toBe(
      '  tl.fromTo("#cap" + i + " .pill", { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.16, ease: "power2.out" }, Math.max(0, words[0] - 0.05));',
    );
    expect(pillTween(composeFootage(composeInput({ film: { ...film, captionEntrance: "none" } })))).toBeUndefined();
  });
});

describe("the underlined lit word", () => {
  it("resolves to the accent underline, the text colour kept", () => {
    expect(getCaptionHighlight({ captionHighlightStyle: "underline" }, { captionHighlight: "#ff8a00" })).toEqual({ ok: true, look: { style: "underline", color: "#ff8a00" } });
  });

  it("renders a hidden bar under every word, shown at the word's start for the hold, the words' colour untouched", () => {
    const html = composeFootage(composeInput());
    expect(html).toContain('<p class="pill"><span id="cw0_0"><i class="ul" id="cu0_0"></i>hello</span> <span id="cw0_1"><i class="ul" id="cu0_1"></i>brave</span>');
    expect(html).toContain(".ul{position:absolute;left:0;right:0;top:1em;height:0.09em;border-radius:0.045em;background:#ff8a00;opacity:0}");
    expect(html).toContain(`words.forEach((t, j) => tl.fromTo("#cu" + i + "_" + j, { opacity: 0 }, { opacity: 1, duration: 0.06, immediateRender: false }, t).to("#cu" + i + "_" + j, { opacity: 0, duration: 0.2 }, t + ${CAPTION_HIGHLIGHT_SECONDS}));`);
    expect(html).not.toContain('{ color: "#ff8a00"');
    expect(html).not.toContain('class="hl"');
  });

  it("draws no bar for text and box highlights", () => {
    const html = composeFootage(composeInput({ film: { ...film, captionHighlightStyle: "text" } }));
    expect(html).not.toContain('class="ul"');
    expect(html).not.toContain(".ul{");
  });

  const dialogue = (ass: string): string[] => ass.split("\n").filter((line) => line.startsWith("Dialogue:"));

  it("draws the draft's bar under the lit word only while it is lit, at the word's place, the text in its own colour", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS, style: STYLE, measure }) ?? "";
    const lines = dialogue(ass);
    // The box is 920 px wide; "hello brave world" is 17 characters, 544 px, so the line starts at 80 + 188 = 268.
    // "brave" starts after "hello " (6 characters, 192 px) at 460 and is 160 px wide, lit from 1.00 to 1.32 s; the
    // 6 px bar's rounded ends start 3 px in.
    const bars = lines.filter((line) => line.includes("CaptionShape") && line.includes("\\1c&H008AFF&"));
    expect(bars.map((line) => line.split(",").slice(1, 3).join(","))).toEqual(["0:00:00.20,0:00:00.52", "0:00:01.00,0:00:01.32", "0:00:02.00,0:00:02.32"]);
    const brave = bars[1] ?? "";
    expect(brave).toContain("\\p1}m 463 1458 l 617 1458 ");
    expect(brave).toContain(" l 463 1464 b 461 1464 460 1463 460 1461 ");
    // The text shows every word in the text colour, never the accent.
    const texts = lines.filter((line) => line.includes(",Caption,"));
    expect(texts.some((line) => line.includes("&H008AFF&"))).toBe(false);
  });

  it("underlines the lit word with libass in the accent without a brand style", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words: WORDS, caption: CAPTION, frame: FRAME, colors: COLORS }) ?? "";
    expect(dialogue(ass)).toContain("Dialogue: 0,0:00:01.00,0:00:01.32,Caption,,0,0,0,,hello {\\u1\\1c&H008AFF&}brave{\\u0\\1c&HFFFFFF&} world");
  });
});
