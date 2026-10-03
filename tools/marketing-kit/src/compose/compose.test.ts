import { describe, expect, it } from "vitest";

import type { Film } from "../film.js";
import { getMarketingMessages } from "../messages/index.js";
import type { RecordingLog } from "../record/record.js";
import type { BeatVoice } from "../voice/voiceover.js";
import { composeFilm, filmTimes, resolveCameraTweens, type CameraTween, type ComposeInput } from "./compose.js";
import { getGeometry } from "./timeline.js";

const film = {
  id: "test",
  title: "Test",
  persona: { name: "Anna", age: 36, tagline: "counts" },
  path: "/",
  format: "9:16",
  device: { viewport: { width: 390, height: 844 }, scale: 3, isMobile: true },
  voice: { voiceId: "v", modelId: "m", language: "en", tempo: 1 },
  beats: [
    { id: "hook", text: "One That." },
    { id: "a", text: "Middle." },
    { id: "cta", text: "End." },
  ],
  hook: { still: "s", shots: [{ mark: "m", scale: 1.5 }] },
  screenGuard: ["x"],
  endCard: { headline: "Count", url: "example.com/calculator", note: "" },
  scene: async () => {},
} as Film;

const voices: BeatVoice[] = [
  { id: "hook", start: 0, end: 2, words: [{ text: "One", start: 0, end: 0.5 }, { text: "That.", start: 1, end: 2 }] },
  { id: "a", start: 3, end: 4, words: [{ text: "Middle.", start: 0, end: 1 }] },
  { id: "cta", start: 5, end: 6, words: [{ text: "End.", start: 0, end: 1 }] },
];

const log: RecordingLog = {
  voiceoverKey: "k",
  beatIds: ["a", "cta"],
  fps: 30,
  frames: 300,
  beats: [
    { id: "a", f0: 6, f1: 150 },
    { id: "cta", f0: 150, f1: 300 },
  ],
  taps: [{ f: 30, x: 100, y: 200 }],
  keys: [45],
  camera: [
    { f: 30, kind: "focus", rect: { x: 0, y: 100, w: 300, h: 40 }, scale: 1.5, whoosh: false },
    { f: 36, kind: "wide", rect: { x: 0, y: 0, w: 390, h: 844 }, scale: 1, whoosh: true },
  ],
  marks: { m: { f: 100, x: 0, y: 0, w: 100, h: 100 } },
  stills: { s: 120 },
  cues: [],
};

const colors = {
  background: "#0b0f14",
  foreground: "#e8eef5",
  muted: "#8296ad",
  accent: "#60a5fa",
  cta: "#34d399",
  onCta: "#0b0f15",
  captionBackground: "#ecf1f7f7",
  captionText: "#0b0f16",
  captionHighlight: "#059670",
};

const assets = {
  screen: "s.mp4",
  rewind: "r.mp4",
  hookStill: "h.jpg",
  lastFrame: "l.jpg",
  voiceover: "v.mp3",
  logo: null,
  sfx: { tap: "assets/sfx/tap.mp3", pop: "assets/sfx/pop.wav" },
};

const input: ComposeInput = {
  film,
  log,
  voices,
  colors,
  geometry: getGeometry({ width: 390, height: 844 }),
  fonts: { heading: null, body: null },
  assets,
  brandName: "Acme <Plan>",
  locale: "en",
  messages: getMarketingMessages("en"),
};

describe("filmTimes", () => {
  // Oracle on paper, not from the code:
  // opening = max(3.8; 0.3 + 2 + 0.1) = 3.8 s; rewind 0.8 s;
  // offset = 3.8 + 0.8 - 6/30 = 4.4 -> at(f) = f/30 + 4.4.
  const times = filmTimes(film, log, voices);

  it("starts the scene after the opening and the rewind", () => {
    expect(times.hook).toBe(3.8);
    expect(times.at(6)).toBe(4.6);
  });

  it("brings in the end card 0.9 s after the last sentence starts and ends the film 1.6 s after its words", () => {
    expect(times.endCard).toBe(10.3); // 150/30 + 4.4 + 0.9
    expect(times.end).toBe(12); // 9.4 + 1 + 1.6
  });

  it("plays the opening voiceover from 0.3 s and scene sentences from the start of their beats", () => {
    expect(times.voiceStart).toEqual({ hook: 0.3, a: 4.6, cta: 9.4 });
  });

  it("refuses a recording that misses a sentence of the script", () => {
    const partial = { ...log, beats: log.beats.slice(0, 1) };
    expect(() => filmTimes(film, partial, voices)).toThrow(/cta/);
  });

  it("refuses a recording with no sentences at all", () => {
    expect(() => filmTimes(film, { ...log, beats: [] }, voices)).toThrow(/no sentences/);
  });
});

describe("resolveCameraTweens", () => {
  const pose = (scale: number) => ({ scale, x: 0, y: 0 });
  const tween = (t: number, dur: number, scale: number): CameraTween => ({ t, dur, pose: pose(scale), ease: "none" });

  it("shortens a move that overlaps the next one", () => {
    const [first] = resolveCameraTweens([tween(0, 0, 1), tween(1, 0.6, 1.5), tween(1.4, 0.5, 1)]).slice(1);
    expect(first?.dur).toBe(0.4);
  });

  it("keeps the later entry on an equal start", () => {
    const resolved = resolveCameraTweens([tween(0, 0, 1), tween(2, 0.5, 1.05), tween(2, 0.6, 1.55)]);
    expect(resolved.map((t) => t.pose.scale)).toEqual([1, 1.55]);
  });

  it("starts every move from the pose the previous one ended on", () => {
    const resolved = resolveCameraTweens([tween(0, 0, 1), tween(1, 0.5, 1.5), tween(3, 0.5, 1.2)]);
    expect(resolved.map((t) => t.from.scale)).toEqual([1, 1, 1.5]);
  });

  it("never lets two moves overlap", () => {
    const resolved = resolveCameraTweens([tween(0, 0, 1), tween(1, 0.6, 1.5), tween(1.2, 0.6, 1), tween(1.5, 0.6, 1.3)]);
    for (let i = 1; i < resolved.length; i += 1) {
      const previous = resolved[i - 1];
      const current = resolved[i];
      expect((previous?.t ?? 0) + (previous?.dur ?? 0)).toBeLessThanOrEqual((current?.t ?? 0) + 1e-9);
    }
  });

  it("returns nothing for no moves", () => {
    expect(resolveCameraTweens([])).toEqual([]);
  });
});

describe("composeFilm", () => {
  it("makes every time in the composition a finite, non-negative number", () => {
    const html = composeFilm(input);
    const values = [...html.matchAll(/data-(?:start|duration|media-start)="([^"]*)"/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThan(10);
    expect(values.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it("refuses a background colour that cannot take an alpha channel", () => {
    expect(() => composeFilm({ ...input, colors: { ...colors, background: "#000" } })).toThrow(/#rrggbb/);
  });

  it("writes the persona card, the language and the escaped brand name from the input", () => {
    const html = composeFilm(input);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<b>Anna, 36</b>");
    expect(html).toContain("<span>Acme &lt;Plan&gt;</span>");
  });

  it("writes the persona card in Polish for the pl locale", () => {
    const messages = getMarketingMessages("pl");
    const html = composeFilm({ ...input, locale: "pl-PL", messages });
    expect(html).toContain('<html lang="pl-PL">');
    expect(html).toContain(`<b>${messages.film.persona.replace("{name}", "Anna").replace("{age}", "36")}</b>`);
  });

  it("paints with the brand's colours, each in its role", () => {
    const html = composeFilm(input);
    expect(html).toContain("border:3px solid #60a5fa"); // accent: the touch ring
    expect(html).toContain("color:#0b0f15;background:#34d399"); // onCta on cta: the link pill
    expect(html).toContain("background:#ecf1f7f7;box-shadow"); // the caption pill
    expect(html).toContain('{ color: "#0b0f16" }, { color: "#059670"'); // a word lights up from captionText to captionHighlight
  });

  it("declares the brand's fonts and uses the heading font on the end card", () => {
    const html = composeFilm({
      ...input,
      fonts: {
        body: { family: "Body Sans", fallback: "sans-serif", faces: [{ src: "assets/fonts/0-body.woff2", weight: "100 900", style: "normal", unicodeRange: "U+0000-00FF" }] },
        heading: { family: "Head", fallback: "serif", faces: [{ src: "assets/fonts/1-head.ttf", weight: "700", style: "italic", unicodeRange: null }] },
      },
    });
    expect(html).toContain('@font-face{font-family:"Body Sans";src:url("assets/fonts/0-body.woff2") format("woff2");font-weight:100 900;font-style:normal;unicode-range:U+0000-00FF}');
    expect(html).toContain('@font-face{font-family:"Head";src:url("assets/fonts/1-head.ttf") format("truetype");font-weight:700;font-style:italic}');
    expect(html).toContain('font-family:"Body Sans",sans-serif;color:');
    expect(html).toContain('.headline{font-family:"Head",serif;');
  });

  it("falls back to the system's sans-serif without brand fonts", () => {
    const html = composeFilm(input);
    expect(html).not.toContain("@font-face");
    expect(html).toContain(".headline{font-family:sans-serif;");
  });

  it("shows the logo next to the brand name only when the brand has one", () => {
    expect(composeFilm(input)).not.toContain('class="logo"');
    expect(composeFilm({ ...input, assets: { ...assets, logo: "assets/logo.svg" } })).toContain('<img class="logo" src="assets/logo.svg" alt="" /><span>Acme &lt;Plan&gt;</span>');
  });

  it("plays only the configured sound effects", () => {
    const html = composeFilm(input);
    expect(html).toContain('src="assets/sfx/tap.mp3"');
    expect(html).toContain('src="assets/sfx/pop.wav"');
    expect(html).not.toContain("whoosh");
  });

  it("sizes the frame and the phone from the geometry", () => {
    const html = composeFilm({ ...input, geometry: getGeometry({ width: 412, height: 915 }) });
    expect(html).toContain('data-width="1080" data-height="1920"');
    expect(html).toContain(".screen{position:absolute;left:14px;top:14px;width:640px;height:1421px;");
  });

  it("composes the 9:16 film exactly as the baseline", async () => {
    await expect(composeFilm(input)).toMatchFileSnapshot("../../tests/snapshots/film-9x16.html");
  });

  it.each([
    ["1:1", "film-1x1.html"],
    ["16:9", "film-16x9.html"],
  ] as const)("composes the %s film from the same recording", async (format, snapshot) => {
    const html = composeFilm({ ...input, film: { ...film, format }, geometry: getGeometry({ width: 390, height: 844 }, format) });
    await expect(html).toMatchFileSnapshot(`../../tests/snapshots/${snapshot}`);
  });

  it("sizes the 1:1 frame and moves captions, persona and end card into it", () => {
    const html = composeFilm({ ...input, geometry: getGeometry({ width: 390, height: 844 }, "1:1") });
    expect(html).toContain('data-width="1080" data-height="1080"');
    expect(html).toContain(".caption{position:absolute;left:60px;right:60px;top:830px;");
    expect(html).toContain(".pill{font-weight:650;font-size:44px;");
    expect(html).toContain(".persona{position:absolute;left:0;right:0;top:30px;");
    expect(html).toContain(".endcard{position:absolute;left:0;right:0;top:470px;");
    expect(html).toContain("font-size:72px;letter-spacing");
  });

  it("puts the 16:9 copy in a column right of the phone", () => {
    const html = composeFilm({ ...input, geometry: getGeometry({ width: 390, height: 844 }, "16:9") });
    expect(html).toContain('data-width="1920" data-height="1080"');
    expect(html).toContain(".caption{position:absolute;left:1100px;right:120px;top:700px;");
    expect(html).toContain(".persona{position:absolute;left:1100px;right:120px;top:150px;");
    expect(html).toContain(".endcard{position:absolute;left:1100px;right:120px;top:330px;");
  });

  it("shrinks the phone to the format's end-card pose", () => {
    // Oracle by hand (16:9, 390×844): screen 415 px at left 393, top 90, height 898; centre (600.5, 539);
    // scale 0.85 → x = 600 - 0.85 × 600.5 = 89.575, y = 540 - 0.85 × 539 = 81.85.
    const html = composeFilm({ ...input, geometry: getGeometry({ width: 390, height: 844 }, "16:9") });
    expect(html).toContain('"pose":{"scale":0.85,"x":89.575,"y":81.85}');
  });

  it("refuses a recording without the opening shot's mark", () => {
    expect(() => composeFilm({ ...input, log: { ...log, marks: {} } })).toThrow(/No mark "m"/);
  });
});
