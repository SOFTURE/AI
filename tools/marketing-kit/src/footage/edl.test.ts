import { describe, expect, it } from "vitest";

import type { TimedWord } from "../voice/voiceover.js";
import { buildEdl, diffEdl, findEdlProblems, getEdlDuration, getEdlJsonSchema, getSegmentStarts, isFiller, normalizeWord, readEdl, remapWords, validateEdl, type Edl, type EdlClip, type EdlSegment } from "./edl.js";
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
    const edl = buildEdl("film", [talk([w("Hello", 1, 1.4), w("yyy", 1.5, 2.2), w("here", 2.3, 2.5), w("Ola.", 2.6, 3)])], OPTIONS, { jump: "zoom", clip: "fade" });
    expect(edl).toEqual({
      version: 2,
      film: "film",
      segments: [
        { id: "s1", clip: "talk", start: 0.9, end: 1.5, transition: "cut", motion: "none" },
        { id: "s1.2", clip: "talk", start: 2.2, end: 3.1, transition: "zoom", motion: "none" },
      ],
    });
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

  it("keeps b-roll whole and a talking clip without words whole, with hard cuts and no zoom by default", () => {
    const clips: EdlClip[] = [talk([w("Hej.", 0.5, 0.9)], 3, "a"), { id: "street", role: "broll", duration: 4, words: [] }, talk([], 2, "b")];
    expect(buildEdl("film", clips, OPTIONS, DEFAULT_TRANSITIONS).segments).toEqual([
      { id: "s1", clip: "a", start: 0.4, end: 1, transition: "cut", motion: "none" },
      { id: "r1", clip: "street", start: 0, end: 4, transition: "cut", motion: "none" },
      { id: "w1", clip: "b", start: 0, end: 2, transition: "cut", motion: "none" },
    ]);
    expect(buildEdl("film", clips, OPTIONS, DEFAULT_TRANSITIONS, { isKenBurns: true }).segments[1]?.motion).toBe("kenburns");
  });

  it("keeps only the chosen sentences and drops a clip whose sentences are all gone", () => {
    const words = [w("Raz", 0.5, 0.8), w("dwa.", 0.9, 1.2), w("Raz", 1.4, 1.7), w("dwa", 1.8, 2), w("trzy.", 2.1, 2.5)];
    const clips: EdlClip[] = [talk(words), talk([w("Nie.", 0.5, 0.9)], 3, "other")];
    const edl = buildEdl("film", clips, OPTIONS, DEFAULT_TRANSITIONS, { keepSentences: ["s2"] });
    expect(edl.segments).toEqual([{ id: "s2", clip: "talk", start: 1.3, end: 2.6, transition: "cut", motion: "none" }]);
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
      version: 2,
      film: "film",
      segments: [
        { id: "g1", clip: "talk", start: 0.9, end: 1.5, transition: "cut", motion: "none" },
        { id: "g2", clip: "street", start: 0, end: 2, transition: "fade", motion: "kenburns" },
        { id: "g3", clip: "talk", start: 2.2, end: 2.6, transition: "fade", motion: "none" },
      ],
    };
    expect(getSegmentStarts(edl)).toEqual([0, 0.6, 2.6]);
    expect(remapWords(edl, words, PL)).toEqual([w("Hello", 0.1, 0.5), w("here", 2.7, 2.9)]);
  });

  it("clamps a word cut by a segment's edge", () => {
    const edl: Edl = { version: 2, film: "film", segments: [{ id: "g4", clip: "talk", start: 1, end: 2, transition: "cut", motion: "none" }] };
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

describe("EDL v2", () => {
  const seg = (id: string, clip: string, start: number, end: number, extra: Partial<EdlSegment> = {}): EdlSegment => ({ id, clip, start, end, transition: "cut", motion: "none", ...extra });
  const edl = (...segments: EdlSegment[]): Edl => ({ version: 2, film: "film", segments });

  it("upgrades a version 1 file with generated ids and reports a broken one in its own terms", () => {
    const read = readEdl({ version: 1, film: "film", segments: [{ clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" }] });
    expect(read).toEqual({ ok: true, edl: edl(seg("seg1", "talk", 0, 2)) });
    expect(readEdl({ version: 1, film: "film", segments: [] })).toEqual({ ok: false, error: "segments: the cut needs at least one segment" });
  });

  it("reads a segment's sound from another clip, muted under it unless ownVolume says otherwise", () => {
    const read = readEdl({ ...edl(seg("r1", "street", 0, 2)), segments: [{ ...seg("r1", "street", 0, 2), audio: { clip: "talk", start: 3, end: 5 } }] });
    expect(read.ok && read.edl.segments[0]?.audio).toEqual({ clip: "talk", start: 3, end: 5, ownVolume: 0 });
  });

  it("finds a repeated id, a sound span past its clip and sound of another length than the picture", () => {
    const cut = edl(seg("s1", "talk", 0, 2), seg("s1", "street", 0, 2, { audio: { clip: "talk", start: 4.5, end: 6, ownVolume: 0 } }));
    expect(validateEdl(cut, [{ id: "talk", duration: 5 }, { id: "street", duration: 3 }], "film")).toEqual([
      'segments[1].id: "s1" appears twice',
      "segments[1].audio.end: 6 s is past the clip's end (5.00 s)",
      "segments[1].audio: 1.5 s of sound for 2 s of picture (end - start must match)",
    ]);
    expect(findEdlProblems).toBe(validateEdl);
  });

  it("puts the borrowed sound's words in the film: b-roll over speech carries the talk's captions", () => {
    const words = { talk: [w("Hello", 3.2, 3.6)], street: [w("noise", 0.5, 0.8)] };
    const cut = edl(seg("s1", "talk", 0, 2), seg("r1", "street", 0, 2, { audio: { clip: "talk", start: 3, end: 5, ownVolume: 0.2 } }));
    expect(remapWords(cut, words, PL)).toEqual([w("Hello", 2.2, 2.6)]);
  });

  it("reports what an edit changed in short lines", () => {
    const before = edl(seg("s1", "talk", 0, 2), seg("s2", "talk", 2, 4), seg("r1", "street", 0, 2), seg("s3", "talk", 4, 6), seg("s4", "talk", 6, 8));
    const after = edl(
      seg("s3", "talk", 4.2, 6),
      seg("s1", "talk", 0, 2, { transition: "fade" }),
      seg("r1", "street", 0, 2, { audio: { clip: "talk", start: 6, end: 8, ownVolume: 0 } }),
      seg("s4", "talk", 6, 8),
      seg("x1", "street", 2, 3),
    );
    expect(diffEdl(before, after)).toEqual([
      "dropped s2",
      "added x1 (street 2–3 s)",
      "moved s3 to the start",
      "s3: talk 4–6 s → talk 4.2–6 s",
      "s1: cut → fade",
      "r1 over s4",
    ]);
    expect(diffEdl(after, before)).toContain("r1 plays its own sound again");
    expect(diffEdl(before, before)).toEqual([]);
  });

  it("publishes a JSON Schema of the file an agent edits", () => {
    const schema = getEdlJsonSchema() as { properties: { version: { const: number } }; title: string };
    expect(schema.properties.version.const).toBe(2);
    expect(schema.title).toContain("edl.json");
  });
});
