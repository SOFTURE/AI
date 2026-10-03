import { describe, expect, it } from "vitest";

import { containsPhrase, sceneBeats, type Film } from "./film.js";

function makeFilm(overrides: Partial<Film> = {}): Film {
  return {
    id: "test",
    title: "Test",
    persona: { name: "Anna", age: 36, tagline: "counts" },
    path: "/",
    format: "9:16",
    device: { viewport: { width: 390, height: 844 }, scale: 3, isMobile: true },
    voice: { voiceId: "v", modelId: "m", language: "en", tempo: 1.1 },
    beats: [
      { id: "hook", text: "Opening." },
      { id: "scene", text: "Middle." },
      { id: "cta", text: "End." },
    ],
    hook: { still: "result", shots: [{ mark: "date", scale: 1.4 }] },
    screenGuard: ["March 2040"],
    endCard: { headline: "Count", url: "example.com/calculator", note: "" },
    scene: async () => {},
    ...overrides,
  };
}

describe("sceneBeats", () => {
  it("records everything but the opening, the end card included", () => {
    expect(sceneBeats(makeFilm()).map((beat) => beat.id)).toEqual(["scene", "cta"]);
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
