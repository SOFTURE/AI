import { describe, expect, it } from "vitest";

import { buildFrameArgs, extractFrames, getFrameTimes, MAX_FRAMES } from "./frames.js";

describe("getFrameTimes", () => {
  it("takes count frames at the middles of equal parts", () => {
    expect(getFrameTimes(10, { count: 4 })).toEqual([1.25, 3.75, 6.25, 8.75]);
  });

  it("takes one frame every few seconds, from the first half step", () => {
    expect(getFrameTimes(7, { everySeconds: 2 })).toEqual([1, 3, 5]);
    expect(getFrameTimes(1, { everySeconds: 2 })).toEqual([0.99]);
  });

  it("caps a long sheet and answers nothing for an empty clip", () => {
    expect(getFrameTimes(1000, { everySeconds: 1 })).toHaveLength(MAX_FRAMES);
    expect(getFrameTimes(0, { count: 3 })).toEqual([]);
  });
});

describe("buildFrameArgs and extractFrames", () => {
  it("writes one scaled JPG frame", () => {
    expect(buildFrameArgs("/c/talk.mp4", 2.5, 360, "/f/frame-001.jpg")).toEqual(["-v", "error", "-y", "-ss", "2.5", "-i", "/c/talk.mp4", "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "3", "/f/frame-001.jpg"]);
  });

  it("refuses a spacing that takes no frame", async () => {
    expect(await extractFrames("/c/talk.mp4", { count: 0 }, { outDir: "/f" })).toEqual({ ok: false, error: "frames: count must be at least 1, everySeconds above 0" });
  });
});
