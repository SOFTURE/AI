import { describe, expect, it } from "vitest";

import {
  buildTtsRequest,
  readTimestampsResponse,
  splitIntoBeats,
  voiceoverKey,
  voiceoverText,
  wordsFromAlignment,
} from "./voiceover.js";

describe("voiceoverKey", () => {
  it("gives the same key for the same text, voice, model and language, so a paid recording is never repeated", () => {
    expect(voiceoverKey("Anna has a cat.", "v", "m", "en")).toBe(voiceoverKey("Anna has a cat.", "v", "m", "en"));
    expect(voiceoverKey("Anna has a cat.", "v", "m", "en")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives a new key for another text, voice, model or language", () => {
    const base = voiceoverKey("Anna has a cat.", "v", "m", "en");
    expect(voiceoverKey("Anna has a dog.", "v", "m", "en")).not.toBe(base);
    expect(voiceoverKey("Anna has a cat.", "w", "m", "en")).not.toBe(base);
    expect(voiceoverKey("Anna has a cat.", "v", "n", "en")).not.toBe(base);
    expect(voiceoverKey("Anna has a cat.", "v", "m", "pl")).not.toBe(base);
  });

  it("matches the key FIRE_TRACKER computes for Polish, so its paid voiceover cache keeps matching", () => {
    // Oracle: FIRE_TRACKER video/src/voiceover.ts at 58e6c84 (language fixed to "pl"), run on the same input.
    const text = "Forty-nine years. That is when Anna stops working.";
    expect(voiceoverKey(text, "P9yx385KN0FOmLll8Lkx", "eleven_multilingual_v2", "pl")).toBe("619a27159288f1e1");
  });
});

describe("voiceoverText", () => {
  it("joins the sentences with a single space", () => {
    expect(voiceoverText([{ id: "a", text: " One. " }, { id: "b", text: "Two." }])).toBe("One. Two.");
  });
});

describe("buildTtsRequest", () => {
  it("asks for the configured language and encodes the voice id", () => {
    const request = buildTtsRequest("Text", "voice id", "model", "pl");
    expect(request.body.language_code).toBe("pl");
    expect(request.url).toContain("/voice%20id/with-timestamps");
  });
});

describe("readTimestampsResponse", () => {
  it("refuses a response without timestamps, because captions would have no times", () => {
    expect(() => readTimestampsResponse({ audio_base64: "AAAA" })).toThrow(/timestamps/);
  });

  it("refuses a response without audio", () => {
    expect(() => readTimestampsResponse({ alignment: null })).toThrow(/audio_base64/);
  });
});

describe("wordsFromAlignment", () => {
  it("builds words from characters, splitting on whitespace", () => {
    const characters = [..."One two."];
    const starts = characters.map((_, i) => i * 0.1);
    const ends = characters.map((_, i) => i * 0.1 + 0.05);
    expect(wordsFromAlignment({ characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends })).toEqual([
      { text: "One", start: 0, end: 0.25 },
      { text: "two.", start: 0.4, end: 0.75 },
    ]);
  });

  it("refuses arrays of different lengths", () => {
    expect(() => wordsFromAlignment({ characters: ["a"], characterStartTimesSeconds: [], characterEndTimesSeconds: [0] })).toThrow(
      /different lengths/,
    );
  });
});

describe("splitIntoBeats", () => {
  const words = [
    { text: "One", start: 0, end: 0.5 },
    { text: "two.", start: 0.6, end: 1.1 },
    { text: "Three.", start: 1.65, end: 2.2 },
  ];
  const beats = [
    { id: "a", text: "One two." },
    { id: "b", text: "Three." },
  ];

  it("splits the words into sentences and shortens the times by the tempo", () => {
    // Oracle computed by hand: 1.65 / 1.1 = 1.5; 2.2 / 1.1 = 2.
    expect(splitIntoBeats(words, beats, 1.1)).toEqual([
      {
        id: "a",
        start: 0,
        end: 1,
        words: [
          { text: "One", start: 0, end: 0.455 },
          { text: "two.", start: 0.545, end: 1 },
        ],
      },
      { id: "b", start: 1.5, end: 2, words: [{ text: "Three.", start: 0, end: 0.5 }] },
    ]);
  });

  it("refuses when the word count does not match the text", () => {
    expect(() => splitIntoBeats(words.slice(0, 2), beats, 1)).toThrow(/has 2 words and the script 3/);
  });
});
