import { describe, expect, it } from "vitest";

import { createFakeSttProvider, makePlaceholderTranscript } from "./fake.js";

describe("makePlaceholderTranscript", () => {
  it("spreads the script's words evenly between the margins", () => {
    expect(makePlaceholderTranscript("Raz dwa", 2.6)).toEqual([
      { text: "Raz", start: 0.3, end: 1.1 },
      { text: "dwa", start: 1.3, end: 2.1 },
    ]);
  });

  it("has no words without a script or room", () => {
    expect(makePlaceholderTranscript(null, 5)).toEqual([]);
    expect(makePlaceholderTranscript("  ", 5)).toEqual([]);
    expect(makePlaceholderTranscript("Raz", 0.5)).toEqual([]);
  });
});

describe("createFakeSttProvider", () => {
  it("answers by the file's name up to its first dot and records the calls", async () => {
    const words = [{ text: "Hej", start: 0, end: 0.3 }];
    const stt = createFakeSttProvider({ transcripts: { talk: words } });
    expect(await stt.transcribe({ audio: "/build/audio/talk.isolated.mp3", language: "pl" })).toEqual({ ok: true, value: { words, language: "pl" } });
    expect(await stt.transcribe({ audio: "/build/audio/other.mp3", language: "pl" })).toEqual({ ok: true, value: { words: [], language: "pl" } });
    expect(stt.calls).toHaveLength(2);
  });
});
