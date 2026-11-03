import { describe, expect, it } from "vitest";
import { stitchChunks } from "../src/stitch.js";

describe("stitchChunks", () => {
  it("shifts segments by their chunk's start", () => {
    const stitched = stitchChunks([
      { start: 0, end: 10, text: "a b", segments: [{ start: 0, end: 4, text: "a" }, { start: 4, end: 9, text: "b" }] },
      { start: 10, end: 20, text: "c", segments: [{ start: 1, end: 5, text: "c" }] },
    ]);

    expect(stitched).toEqual([
      { start: 0, end: 4, text: "a" },
      { start: 4, end: 9, text: "b" },
      { start: 11, end: 15, text: "c" },
    ]);
  });

  it("cuts an overlap at its middle, keeping each segment once, from the chunk that heard it whole", () => {
    // Chunk 1 is 0–10, chunk 2 is 8–18: the cut is at 9.
    const stitched = stitchChunks([
      {
        start: 0,
        end: 10,
        text: "",
        segments: [
          { start: 0, end: 7, text: "first" },
          { start: 7, end: 10, text: "edge-cut" },
        ],
      },
      {
        start: 8,
        end: 18,
        text: "",
        segments: [
          { start: 0, end: 0.5, text: "tail" },
          { start: 0.5, end: 3, text: "whole" },
          { start: 3, end: 9, text: "last" },
        ],
      },
    ]);

    // "edge-cut" (middle 8.5) and "tail" (middle 8.25) fall before the cut and stay with chunk 1 only as "edge-cut".
    expect(stitched).toEqual([
      { start: 0, end: 7, text: "first" },
      { start: 7, end: 10, text: "edge-cut" },
      { start: 8.5, end: 11, text: "whole" },
      { start: 11, end: 17, text: "last" },
    ]);
  });

  it("gives a chunk without segments one segment spanning its part", () => {
    expect(stitchChunks([{ start: 0, end: 30, text: " all of it ", segments: [] }])).toEqual([
      { start: 0, end: 30, text: "all of it" },
    ]);
  });

  it("drops empty segments and returns nothing for no chunks", () => {
    expect(stitchChunks([{ start: 0, end: 5, text: "", segments: [{ start: 0, end: 5, text: " " }] }])).toEqual([]);
    expect(stitchChunks([])).toEqual([]);
  });
});
