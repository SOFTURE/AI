import { describe, expect, it } from "vitest";

import type { TimedWord } from "../voice/voiceover.js";
import { buildEdl, findEdlProblems, getEdlDuration, getSegmentStarts, isFiller, normalizeWord, readEdl, remapWords, type Edl, type EdlClip } from "./edl.js";
import { DEFAULT_FILLERS, DEFAULT_TRANSITIONS, type CutOptions } from "./film.js";

const PL = DEFAULT_FILLERS.pl ?? [];
const OPTIONS: CutOptions = { fillers: PL, pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null };

const w = (text: string, start: number, end: number): TimedWord => ({ text, start, end });

const talk = (words: TimedWord[], duration = 10, id = "talk"): EdlClip => ({ id, role: "talk", duration, words });

describe("isFiller", () => {
  it.each(["yyy", "Yyyy,", "eee", "yhm.", "Hmm", "eeem"])("takes %s for a Polish filler", (text) => {
    expect(isFiller(text, PL)).toBe(true);
  });

  it.each(["tak", "ye", "mam", "", "..."])("keeps %s", (text) => {
    expect(isFiller(text, PL)).toBe(false);
  });

  it("compares without case, punctuation and repeated letters", () => {
    expect(normalizeWord("Yyyy,")).toBe("y");
    expect(normalizeWord("Café!")).toBe("café");
  });
});

describe("buildEdl", () => {
  it("cuts a filler out of a sentence with padding that never reaches into it", () => {
    const edl = buildEdl("film", [talk([w("Hello", 1, 1.4), w("yyy", 1.5, 2.2), w("here", 2.3, 2.5), w("Ola.", 2.6, 3)])], OPTIONS, DEFAULT_TRANSITIONS);
    expect(edl.segments).toEqual([
      { clip: "talk", start: 0.9, end: 1.5, transition: "cut", motion: "none" },
      { clip: "talk", start: 2.2, end: 3.1, transition: "zoom", motion: "none" },
    ]);
  });

  it("cuts a pause longer than pauseSeconds and keeps a shorter one", () => {
    const words = [w("Raz", 0.5, 0.8), w("dwa", 1.2, 1.5), w("trzy", 3.5, 3.9)];
    const edl = buildEdl("film", [talk(words)], OPTIONS, DEFAULT_TRANSITIONS);
    expect(edl.segments.map((s) => [s.start, s.end])).toEqual([
      [0.4, 1.6],
      [3.4, 4],
    ]);
  });

  it("keeps a short filler cut out even when the padding on both sides would cover it", () => {
    const words = [w("Raz", 1, 1.2), w("eee", 1.2, 1.3), w("dwa", 1.3, 1.6)];
    const edl = buildEdl("film", [talk(words)], OPTIONS, DEFAULT_TRANSITIONS);
    expect(edl.segments.map((s) => [s.start, s.end])).toEqual([
      [0.9, 1.2],
      [1.3, 1.7],
    ]);
  });

  it("joins two runs split by a pause when their padding overlaps", () => {
    const words = [w("Raz", 1, 1.2), w("dwa", 1.9, 2.1)];
    const edl = buildEdl("film", [talk(words)], { ...OPTIONS, padSeconds: 0.4 }, DEFAULT_TRANSITIONS);
    expect(edl.segments.map((s) => [s.start, s.end])).toEqual([[0.6, 2.5]]);
  });

  it("keeps b-roll whole with a slow zoom and a talking clip without words whole", () => {
    const edl = buildEdl(
      "film",
      [talk([w("Hej.", 0.5, 0.9)], 3, "a"), { id: "street", role: "broll", duration: 4, words: [] }, talk([], 2, "b")],
      OPTIONS,
      DEFAULT_TRANSITIONS,
    );
    expect(edl.segments).toEqual([
      { clip: "a", start: 0.4, end: 1, transition: "cut", motion: "none" },
      { clip: "street", start: 0, end: 4, transition: "fade", motion: "kenburns" },
      { clip: "b", start: 0, end: 2, transition: "fade", motion: "none" },
    ]);
  });

  it("drops a run shorter than a quarter second", () => {
    const edl = buildEdl("film", [talk([w("a", 1, 1.02), w("Long sentence.", 4, 5)])], { ...OPTIONS, padSeconds: 0 }, DEFAULT_TRANSITIONS);
    expect(edl.segments.map((s) => [s.start, s.end])).toEqual([[4, 5]]);
  });

  it("shortens the segment that crosses maxSeconds and drops the rest", () => {
    const clips: EdlClip[] = [
      { id: "a", role: "broll", duration: 4, words: [] },
      { id: "b", role: "broll", duration: 4, words: [] },
      { id: "c", role: "broll", duration: 4, words: [] },
    ];
    const edl = buildEdl("film", clips, { ...OPTIONS, maxSeconds: 6 }, { jump: "cut", clip: "whoosh" });
    expect(edl.segments.map((s) => [s.clip, s.end, s.transition])).toEqual([
      ["a", 4, "cut"],
      ["b", 2, "whoosh"],
    ]);
    expect(getEdlDuration(edl)).toBe(6);
  });
});

describe("remapWords", () => {
  it("shifts every word after a cut and leaves fillers out", () => {
    const words = { talk: [w("Hello", 1, 1.4), w("yyy", 1.5, 2.2), w("here", 2.3, 2.5)], street: [] };
    const edl: Edl = {
      version: 1,
      film: "film",
      segments: [
        { clip: "talk", start: 0.9, end: 1.5, transition: "cut", motion: "none" },
        { clip: "street", start: 0, end: 2, transition: "fade", motion: "kenburns" },
        { clip: "talk", start: 2.2, end: 2.6, transition: "fade", motion: "none" },
      ],
    };
    expect(getSegmentStarts(edl)).toEqual([0, 0.6, 2.6]);
    expect(remapWords(edl, words, PL)).toEqual([w("Hello", 0.1, 0.5), w("here", 2.7, 2.9)]);
  });

  it("clamps a word cut by a segment's edge", () => {
    const edl: Edl = { version: 1, film: "film", segments: [{ clip: "talk", start: 1, end: 2, transition: "cut", motion: "none" }] };
    expect(remapWords(edl, { talk: [w("long", 0.8, 1.6)] }, PL)).toEqual([w("long", 0, 0.6)]);
  });
});

describe("readEdl and findEdlProblems", () => {
  const edl = { version: 1, film: "film", segments: [{ clip: "talk", start: 0, end: 2, transition: "zoom", motion: "none" }] };

  it("reads a valid file and finds nothing wrong with matching clips", () => {
    const read = readEdl(edl);
    expect(read.ok).toBe(true);
    if (read.ok) expect(findEdlProblems(read.edl, [{ id: "talk", duration: 5 }], "film")).toEqual([]);
  });

  it("names the field of a broken file", () => {
    expect(readEdl({ ...edl, segments: [{ ...edl.segments[0], transition: "spin" }] })).toEqual({
      ok: false,
      error: 'segments.0.transition: Invalid option: expected one of "cut"|"fade"|"zoom"|"whoosh"',
    });
  });

  it("finds an unknown clip, a segment past the clip's end, a too short segment and another film", () => {
    const read = readEdl({
      version: 1,
      film: "other",
      segments: [
        { clip: "ghost", start: 0, end: 1, transition: "cut", motion: "none" },
        { clip: "talk", start: 3, end: 9, transition: "cut", motion: "none" },
        { clip: "talk", start: 1, end: 1.1, transition: "cut", motion: "none" },
      ],
    });
    if (!read.ok) throw new Error(read.error);
    expect(findEdlProblems(read.edl, [{ id: "talk", duration: 5 }], "film")).toEqual([
      'it belongs to film "other", not "film"',
      'segments[0].clip: no clip "ghost" in the film',
      "segments[1].end: 9 s is past the clip's end (5.00 s)",
      "segments[2]: shorter than 0.25 s (start 1, end 1.1)",
    ]);
  });
});
