import { describe, expect, it } from "vitest";

import { getFilmKeyTerms, normalizeKeyTerms, SCRIBE_KEYTERM_LIMITS } from "./keyterms.js";

describe("normalizeKeyTerms", () => {
  it("trims, collapses spaces, drops blanks and duplicates, and sorts by code point", () => {
    expect(normalizeKeyTerms(["  Zakopane ", "ElevenLabs", "", "Acme  Cloud", "ElevenLabs", "elevenlabs"])).toEqual({
      ok: true,
      terms: ["Acme Cloud", "ElevenLabs", "Zakopane", "elevenlabs"],
    });
  });

  it("answers an empty list for no terms", () => {
    expect(normalizeKeyTerms([])).toEqual({ ok: true, terms: [] });
  });

  it("accepts a term at the character and word limits", () => {
    const fifty = "a".repeat(SCRIBE_KEYTERM_LIMITS.maxCharacters);
    expect(normalizeKeyTerms([fifty, "one two three four five"])).toEqual({ ok: true, terms: [fifty, "one two three four five"] });
  });

  it("names every term over a limit", () => {
    const long = "b".repeat(51);
    expect(normalizeKeyTerms([long, "one two three four five six"])).toEqual({
      ok: false,
      errors: [`key term "${long}": 51 characters, at most 50.`, 'key term "one two three four five six": 6 words, at most 5.'],
    });
  });

  it("refuses more than 1000 distinct terms and accepts exactly 1000", () => {
    const terms = Array.from({ length: 1001 }, (_, index) => `term${index}`);
    expect(normalizeKeyTerms(terms.slice(0, 1000)).ok).toBe(true);
    expect(normalizeKeyTerms(terms)).toEqual({ ok: false, errors: ["key terms: 1001 terms, at most 1000."] });
  });
});

describe("getFilmKeyTerms", () => {
  it("answers none for a film without key terms", () => {
    expect(getFilmKeyTerms({})).toEqual({ ok: true, terms: [] });
  });
});
