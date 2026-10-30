import { describe, expect, it } from "vitest";

import type { TimedWord } from "../voice/voiceover.js";
import { findRetakes, splitFilmSentences, splitSentences } from "./sentences.js";

/** Words spoken one after another, 0.3 s each with 0.1 s between, from `start`. */
function say(text: string, start: number): TimedWord[] {
  return text.split(" ").map((word, index) => ({ text: word, start: start + index * 0.4, end: start + index * 0.4 + 0.3 }));
}

describe("splitSentences", () => {
  it("splits at the end of a sentence and at a long pause, with ids from the given number", () => {
    const words = [...say("Hi there.", 0), ...say("This is", 1), ...say("a test", 3)];
    const sentences = splitSentences(words, "talk", 4);
    expect(sentences.map((sentence) => [sentence.id, sentence.text, sentence.isComplete])).toEqual([
      ["s4", "Hi there.", true],
      ["s5", "This is", false],
      ["s6", "a test", false],
    ]);
    expect(sentences[0]).toMatchObject({ clip: "talk", start: 0, end: 0.7 });
  });

  it("numbers the sentences across the film's talking clips only", () => {
    const sentences = splitFilmSentences([
      { id: "a", role: "talk", words: say("One. Two.", 0) },
      { id: "street", role: "broll", words: say("Noise.", 0) },
      { id: "b", role: "talk", words: say("Three.", 0) },
    ]);
    expect(sentences.map((sentence) => `${sentence.id}:${sentence.clip}:${sentence.text}`)).toEqual(["s1:a:One.", "s2:a:Two.", "s3:b:Three."]);
  });

  it("answers nothing for no words", () => {
    expect(splitSentences([], "talk")).toEqual([]);
  });
});

describe("findRetakes", () => {
  it("suggests dropping an earlier take of a sentence said again", () => {
    const sentences = splitSentences([...say("We built this for small teams.", 0), ...say("We built it for small teams.", 4)], "talk");
    expect(findRetakes(sentences)).toEqual([{ sentence: "s1", kind: "retake", of: "s2", reason: "s2 says it again (83 % of the words); the later take is kept" }]);
  });

  it("suggests dropping a false start that the next sentence begins again", () => {
    const sentences = splitSentences([...say("So the app.", 0), ...say("So the app counts your date.", 2)], "talk");
    expect(findRetakes(sentences)).toEqual([{ sentence: "s1", kind: "false-start", of: "s2", reason: "s2 starts with the same words and finishes the sentence" }]);
  });

  it("suggests dropping a sentence that breaks off or that the clip ends before", () => {
    const sentences = splitFilmSentences([
      { id: "a", role: "talk", words: [...say("And then we—", 0), ...say("Fine.", 3)] },
      { id: "b", role: "talk", words: say("This one never", 0) },
    ]);
    expect(findRetakes(sentences)).toEqual([
      { sentence: "s1", kind: "cut-off", reason: "it breaks off mid-sentence" },
      { sentence: "s3", kind: "cut-off", reason: "the clip ends before the sentence does" },
    ]);
  });

  it("leaves different sentences and other clips alone", () => {
    const sentences = splitFilmSentences([
      { id: "a", role: "talk", words: say("Count your own date. It takes a minute.", 0) },
      { id: "b", role: "talk", words: say("Count your own date.", 0) },
    ]);
    expect(findRetakes(sentences)).toEqual([]);
  });
});
