import { describe, expect, it } from "vitest";

import { CAMERA_TARGET, SCREEN, SCREEN_SCALE, cameraPose, captionChunks, fitScale, rewindFrames, unionRect, widePose } from "./timeline.js";

/** A page point (CSS px) after passing through the phone and the camera: a path independent of `cameraPose`. */
function project(point: { x: number; y: number }, pose: { scale: number; x: number; y: number }) {
  const inFrameX = SCREEN.left + SCREEN_SCALE * point.x;
  const inFrameY = SCREEN.top + SCREEN_SCALE * point.y;
  return { x: pose.scale * inFrameX + pose.x, y: pose.scale * inFrameY + pose.y };
}

describe("cameraPose", () => {
  it.each([1, 1.55])("puts the field's centre on the frame's target point at scale %s", (scale) => {
    const rect = { x: 41, y: 327, w: 308, h: 40 };
    const center = project({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, cameraPose(rect, scale));
    expect(center.x).toBeCloseTo(CAMERA_TARGET.x, 2);
    expect(center.y).toBeCloseTo(CAMERA_TARGET.y, 2);
  });

  it("leaves the phone where it stands at scale 1 on the whole screen", () => {
    expect(widePose(1)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("fitScale", () => {
  it("does not zoom a narrow button beyond the recording's sharpness", () => {
    expect(fitScale({ x: 0, y: 0, w: 60, h: 40 })).toBe(1.7);
  });

  it("fills 80% of the frame with an element as wide as the phone", () => {
    // Oracle by hand: the screen is 640 px, 80% of the frame is 864 px -> 864 / 640 = 1.35.
    expect(fitScale({ x: 0, y: 0, w: 390, h: 40 })).toBe(1.35);
  });
});

describe("unionRect", () => {
  it("encloses a label and a value in one rectangle", () => {
    expect(unionRect([{ x: 10, y: 20, w: 100, h: 10 }, { x: 5, y: 40, w: 50, h: 30 }])).toEqual({ x: 5, y: 20, w: 105, h: 50 });
  });

  it("refuses an empty list", () => {
    expect(() => unionRect([])).toThrow(/empty list/);
  });
});

describe("captionChunks", () => {
  const word = (text: string, start: number) => ({ text, start, end: start + 0.3 });

  it("breaks after four words", () => {
    const words = ["a", "b", "c", "d", "e"].map((t, i) => word(t, i));
    expect(captionChunks(words).map((c) => c.words.map((w) => w.text).join(" "))).toEqual(["a b c d", "e"]);
  });

  it("breaks after a comma and a full stop before reaching the limit", () => {
    const words = [word("March,", 0), word("year.", 1), word("Next", 2)];
    expect(captionChunks(words).map((c) => c.words.length)).toEqual([1, 1, 1]);
  });

  it("lasts from the first to the last word of the chunk", () => {
    const [chunk] = captionChunks([word("One", 1), word("two", 2)]);
    expect([chunk?.start, chunk?.end]).toEqual([1, 2.3]);
  });

  it("returns no chunk for no words", () => {
    expect(captionChunks([])).toEqual([]);
  });
});

describe("rewindFrames", () => {
  it("gives 24 frames from the opening frame back to the scene's start, both ends included", () => {
    const frames = rewindFrames(6, 582);
    expect(frames).toHaveLength(24);
    expect([frames[0], frames[23]]).toEqual([582, 6]);
    // Step by hand: (582 - 6) / 23 ≈ 25.04.
    expect(frames[1]).toBe(557);
  });

  it("repeats frames on a short span but keeps the clip at 24 frames", () => {
    const frames = rewindFrames(10, 15);
    expect(frames).toHaveLength(24);
    expect(new Set(frames)).toEqual(new Set([15, 14, 13, 12, 11, 10]));
  });

  it("refuses an opening frame before the start of the scene", () => {
    expect(() => rewindFrames(100, 50)).toThrow(/before the start/);
  });
});
