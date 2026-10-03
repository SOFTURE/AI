import { describe, expect, it } from "vitest";

import { containsPhrase, isChannelCode, sceneBeats, validateFilm, type Film } from "./film.js";

function makeFilm(overrides: Partial<Film> = {}): Film {
  return {
    id: "test",
    title: "Test",
    persona: { name: "Anna", age: 36, tagline: "counts" },
    voice: { voiceId: "v", modelId: "m", tempo: 1.1 },
    beats: [
      { id: "hook", text: "Opening." },
      { id: "scene", text: "Middle." },
      { id: "cta", text: "End." },
    ],
    hook: { still: "result", shots: [{ mark: "date", scale: 1.4 }] },
    screenGuard: ["March 2040"],
    channels: { instagram: "ig-01", facebook: "fb-01", tiktok: "tiktok-01" },
    endCard: { headline: "Count", url: "example.com/calculator", note: "" },
    post: { caption: "Caption", hashtags: [] },
    scene: async () => {},
    ...overrides,
  };
}

describe("validateFilm", () => {
  it("accepts a valid script", () => {
    expect(() => validateFilm(makeFilm())).not.toThrow();
  });

  it("refuses a channel code the channel reader would change, because visits from the film would be uncountable", () => {
    const film = makeFilm({ channels: { instagram: "IG-01", facebook: "fb-01", tiktok: "tiktok-01" } });
    expect(() => validateFilm(film)).toThrow(/instagram "IG-01"/);
  });

  it("refuses an empty screen guard: a film that declares nothing could say what the screen does not show", () => {
    expect(() => validateFilm(makeFilm({ screenGuard: [] }))).toThrow(/screen guard/);
  });

  it("refuses a repeated sentence id, because scene beats bind by id", () => {
    const beats = [
      { id: "hook", text: "a" },
      { id: "x", text: "b" },
      { id: "x", text: "c" },
    ];
    expect(() => validateFilm(makeFilm({ beats }))).toThrow(/"x" appears twice/);
  });

  it("refuses a tempo outside 0.8-1.3", () => {
    expect(() => validateFilm(makeFilm({ voice: { voiceId: "v", modelId: "m", tempo: 2 } }))).toThrow(/tempo/);
  });

  it("refuses a film with fewer than three sentences", () => {
    expect(() => validateFilm(makeFilm({ beats: [{ id: "hook", text: "a" }, { id: "cta", text: "b" }] }))).toThrow(/at least three/);
  });
});

describe("sceneBeats", () => {
  it("records everything but the opening, the end card included", () => {
    expect(sceneBeats(makeFilm()).map((beat) => beat.id)).toEqual(["scene", "cta"]);
  });
});

describe("validateFilm: opening and ids", () => {
  it("refuses an opening shot waiting for a word the voiceover does not say", () => {
    const film = makeFilm({ hook: { still: "result", shots: [{ mark: "a", scale: 1.4 }, { mark: "b", scale: 1.2, word: "That" }] } });
    expect(() => validateFilm(film)).toThrow(/"That"/);
  });

  it("refuses a sentence id that does not fit an HTML attribute", () => {
    const beats = [
      { id: "hook", text: "a" },
      { id: "Bad id", text: "b" },
      { id: "cta", text: "c" },
    ];
    expect(() => validateFilm(makeFilm({ beats }))).toThrow(/"Bad id"/);
  });
});

describe("isChannelCode", () => {
  it("accepts lowercase letters, digits and hyphens", () => {
    expect(isChannelCode("tiktok-01")).toBe(true);
  });

  it.each([
    ["an empty code", ""],
    ["uppercase", "IG-01"],
    ["a space", "ig 01"],
    ["a slash from a pasted URL", "ig/01"],
    ["21 characters", "a".repeat(21)],
  ])("refuses %s", (_case, code) => {
    expect(isChannelCode(code)).toBe(false);
  });

  it("accepts exactly 20 characters", () => {
    expect(isChannelCode("a".repeat(20))).toBe(true);
  });
});

describe("containsPhrase", () => {
  it("finds the phrase despite a non-breaking space in an amount", () => {
    expect(containsPhrase("Spend 600 zl less every month", "Spend 600 zl less")).toBe(true);
  });

  it("does not let '49 years' pass thanks to '149 years': the guard compares whole words", () => {
    expect(containsPhrase("at the age of 149 years", "49 years")).toBe(false);
    expect(containsPhrase("Exit age 49 years", "49 years")).toBe(true);
  });
});
