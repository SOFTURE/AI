import { describe, expect, it } from "vitest";

import { describeCheckScreenFailure, describeSentenceFailure, findMissingPhrases, getCheckScreenPhrases } from "./screen-guard.js";

describe("getCheckScreenPhrases", () => {
  const sentence = { id: "result", text: "Fifty-five, then.", screenGuard: ["age 55", "1,754 a month"] };

  it("checks only the video's phrases before the first sentence", () => {
    expect(getCheckScreenPhrases(["49 years"], null)).toEqual(["49 years"]);
  });

  it("checks the video's phrases and the current sentence's own", () => {
    expect(getCheckScreenPhrases(["49 years"], sentence)).toEqual(["49 years", "age 55", "1,754 a month"]);
  });

  it("checks the video's phrases only inside a sentence without its own", () => {
    expect(getCheckScreenPhrases(["49 years"], { id: "age", text: "She types her age." })).toEqual(["49 years"]);
  });

  it("checks the sentence's phrases when the video has none", () => {
    expect(getCheckScreenPhrases([], sentence)).toEqual(["age 55", "1,754 a month"]);
  });
});

describe("findMissingPhrases", () => {
  it("returns the phrases the text does not contain as whole words, in order", () => {
    expect(findMissingPhrases("Exit age 49 years, March 2040", ["149 years", "49 years", "April 2040"])).toEqual(["149 years", "April 2040"]);
  });

  it("returns nothing for an empty list", () => {
    expect(findMissingPhrases("", [])).toEqual([]);
  });
});

describe("the failure messages", () => {
  it("name every missing phrase and the file to fix for checkScreen", () => {
    expect(describeCheckScreenFailure(["49 years", "March 2040"], "marketing.json")).toBe(
      'The screen does not say what the voiceover says: missing "49 years", "March 2040". ' +
        'The app counts from the recording day: if the voiceover was paid for on another day, pin that day in the video\'s "today" ' +
        "(or pass --today=YYYY-MM-DD); otherwise fix the sentences and phrases in marketing.json.",
    );
  });

  it("name the sentence whose phrases were not on screen when it ended", () => {
    expect(describeSentenceFailure("result", ["1,754 a month"], "marketing.json")).toBe(
      'Sentence "result" ended without its screenGuard phrases on screen: missing "1,754 a month". ' +
        "Reveal them before the sentence ends, or check them where they show with a checkScreen inside the sentence. " +
        'The app counts from the recording day: if the voiceover was paid for on another day, pin that day in the video\'s "today" ' +
        "(or pass --today=YYYY-MM-DD); otherwise fix the sentences and phrases in marketing.json.",
    );
  });
});
