import { describe, expect, it } from "vitest";
import { toParagraphs, toSrt, toVtt } from "../src/index.js";

const segments = [
  { start: 0, end: 2.5, text: " Hello there. " },
  { start: 2.5, end: 4.0004, text: "How are\nyou?" },
  { start: 3_725.25, end: 3_727.9999, text: "Much later." },
];

describe("toSrt", () => {
  it("numbers the cues from 1 and writes HH:MM:SS,mmm times rounded to the millisecond", () => {
    expect(toSrt(segments)).toBe(
      [
        "1\n00:00:00,000 --> 00:00:02,500\nHello there.\n",
        "2\n00:00:02,500 --> 00:00:04,000\nHow are you?\n",
        "3\n01:02:05,250 --> 01:02:08,000\nMuch later.\n",
      ].join("\n"),
    );
  });

  it("skips segments without text and returns an empty string for none", () => {
    expect(toSrt([{ start: 0, end: 1, text: "  " }])).toBe("");
    expect(toSrt([])).toBe("");
  });

  it("lets hours grow past 99", () => {
    expect(toSrt([{ start: 360_000, end: 360_001, text: "x" }])).toBe("1\n100:00:00,000 --> 100:00:01,000\nx\n");
  });
});

describe("toVtt", () => {
  it("writes the WEBVTT header and HH:MM:SS.mmm times", () => {
    expect(toVtt(segments.slice(0, 2))).toBe(
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.\n\n00:00:02.500 --> 00:00:04.000\nHow are you?\n",
    );
  });

  it("writes only the header for no segments", () => {
    expect(toVtt([])).toBe("WEBVTT\n");
  });
});

describe("toParagraphs", () => {
  it("joins segments with spaces and breaks paragraphs at pauses of the gap or longer", () => {
    expect(toParagraphs(segments)).toBe("Hello there. How are you?\n\nMuch later.");
  });

  it("breaks after a sentence once a paragraph reaches maxChars", () => {
    const long = [
      { start: 0, end: 1, text: "One two three" },
      { start: 1, end: 2, text: "four." },
      { start: 2, end: 3, text: "Five." },
    ];

    expect(toParagraphs(long, { maxChars: 10 })).toBe("One two three four.\n\nFive.");
  });

  it("honours a custom gap and returns an empty string for no segments", () => {
    expect(toParagraphs(segments.slice(0, 2), { gapSeconds: 0 })).toBe("Hello there.\n\nHow are you?");
    expect(toParagraphs([])).toBe("");
  });
});
