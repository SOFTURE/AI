import { describe, expect, it } from "vitest";

import type { Film } from "../film.js";
import { getMarketingMessages } from "../messages/index.js";
import type { RecordingLog } from "../record/record.js";
import type { BeatVoice } from "../voice/voiceover.js";
import { composeFilm, filmTimes, resolveCameraTweens, type CameraTween, type ComposeInput } from "./compose.js";

const film = {
  id: "test",
  title: "Test",
  persona: { name: "Anna", age: 36, tagline: "counts" },
  voice: { voiceId: "v", modelId: "m", tempo: 1 },
  beats: [
    { id: "hook", text: "One That." },
    { id: "a", text: "Middle." },
    { id: "cta", text: "End." },
  ],
  hook: { still: "s", shots: [{ mark: "m", scale: 1.5 }] },
  screenGuard: ["x"],
  channels: { instagram: "ig-01", facebook: "fb-01", tiktok: "tiktok-01" },
  endCard: { headline: "Count", url: "example.com/calculator", note: "" },
  post: { caption: "", hashtags: [] },
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

const tokens = {
  background: "#0b0f14",
  surface: "#131a23",
  "surface-raised": "#1a232e",
  border: "#243040",
  foreground: "#e8eef5",
  muted: "#8296ad",
  accessible: "#34d399",
  locked: "#fbbf24",
  debt: "#f87171",
  accent: "#60a5fa",
};

const assets = { screen: "s.mp4", rewind: "r.mp4", hookStill: "h.jpg", lastFrame: "l.jpg", voiceover: "v.mp3" };

const input: ComposeInput = {
  film,
  log,
  voices,
  tokens,
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
    expect(() => composeFilm({ ...input, tokens: { ...tokens, background: "#000" } })).toThrow(/#rrggbb/);
  });

  it("writes the persona card, the language and the escaped brand name from the input", () => {
    const html = composeFilm(input);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<b>Anna, 36</b>");
    expect(html).toContain("<span>Acme &lt;Plan&gt;</span>");
  });

  it("writes the persona card in Polish for the pl locale", () => {
    const messages = getMarketingMessages("pl");
    const html = composeFilm({ ...input, locale: "pl", messages });
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain(`<b>${messages.film.persona.replace("{name}", "Anna").replace("{age}", "36")}</b>`);
  });

  it("refuses a recording without the opening shot's mark", () => {
    expect(() => composeFilm({ ...input, log: { ...log, marks: {} } })).toThrow(/No mark "m"/);
  });
});
