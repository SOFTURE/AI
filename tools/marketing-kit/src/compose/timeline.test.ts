import { describe, expect, it } from "vitest";

import {
  LAYOUTS,
  VIDEO_FORMATS,
  cameraPose,
  captionChunks,
  fitScale,
  fitsFrame,
  getGeometry,
  resolveLayout,
  rewindFrames,
  unionRect,
  widePose,
} from "./timeline.js";

/** The phone FIRE_TRACKER records: the poses below are pinned on it. */
const PHONE = getGeometry({ width: 390, height: 844 });

/** A page point (CSS px) after passing through the phone and the camera: a path independent of `cameraPose`. */
function project(point: { x: number; y: number }, pose: { scale: number; x: number; y: number }) {
  const inFrameX = PHONE.screen.left + (640 / 390) * point.x;
  const inFrameY = PHONE.screen.top + (640 / 390) * point.y;
  return { x: pose.scale * inFrameX + pose.x, y: pose.scale * inFrameY + pose.y };
}

describe("cameraPose", () => {
  it.each([1, 1.55])("puts the field's centre on the frame's target point at scale %s", (scale) => {
    const rect = { x: 41, y: 327, w: 308, h: 40 };
    const center = project({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, cameraPose(PHONE, rect, scale));
    expect(center.x).toBeCloseTo(540, 2);
    expect(center.y).toBeCloseTo(900, 2);
  });

  it("leaves the phone where it stands at scale 1 on the whole screen", () => {
    expect(widePose(PHONE, 1)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("fitScale", () => {
  it("does not zoom a narrow button beyond the recording's sharpness", () => {
    expect(fitScale(PHONE, { x: 0, y: 0, w: 60, h: 40 })).toBe(1.7);
  });

  it("fills 80% of the frame with an element as wide as the phone", () => {
    // Oracle by hand: the screen is 640 px, 80% of the frame is 864 px -> 864 / 640 = 1.35.
    expect(fitScale(PHONE, { x: 0, y: 0, w: 390, h: 40 })).toBe(1.35);
  });
});

describe("resolveLayout", () => {
  it.each(VIDEO_FORMATS)("returns a fresh copy of the %s table without an override", (format) => {
    const layout = resolveLayout(format, {});
    expect(layout).toEqual(LAYOUTS[format]);
    expect(layout).not.toBe(LAYOUTS[format]);
    expect(layout.endCard.phone.center).not.toBe(LAYOUTS[format].endCard.phone.center);
  });

  it("changes only the caption font size it is given", () => {
    const layout = resolveLayout("16:9", { caption: { fontSize: 44 } });
    expect(layout.caption).toEqual({ top: 700, left: 1100, right: 120, fontSize: 44 });
    expect({ ...layout, caption: LAYOUTS["16:9"].caption }).toEqual(LAYOUTS["16:9"]);
  });

  it("moves the end-card phone's centre on one axis and keeps the other and the scale", () => {
    const layout = resolveLayout("9:16", { endCard: { phone: { center: { x: 500 } } } });
    expect(layout.endCard.phone).toEqual({ scale: 0.58, center: { x: 500, y: 640 } });
  });

  it("keeps the table's value for a key set to undefined", () => {
    const layout = resolveLayout("1:1", { persona: { top: undefined, left: 40 }, endCard: { headlineSize: undefined } });
    expect(layout.persona).toEqual({ top: 30, left: 40, right: 0 });
    expect(layout.endCard.headlineSize).toBe(72);
  });

  it("leaves the table unchanged", () => {
    const before = structuredClone(LAYOUTS);
    resolveLayout("9:16", { caption: { top: 1400 }, persona: { right: 20 }, endCard: { top: 1100, phone: { scale: 0.5 } } });
    expect(LAYOUTS).toEqual(before);
  });
});

describe("getGeometry", () => {
  it("lays out the caption, persona and end card from an override", () => {
    const geometry = getGeometry({ width: 390, height: 844 }, "16:9", {
      caption: { top: 760, fontSize: 40 },
      persona: { left: 1000 },
      endCard: { headlineSize: 64, phone: { scale: 0.8 } },
    });
    expect(geometry.caption).toEqual({ top: 760, left: 1100, right: 120, fontSize: 40 });
    expect(geometry.persona).toEqual({ top: 150, left: 1000, right: 120 });
    expect(geometry.endCard).toEqual({ top: 330, left: 1100, right: 120, headlineSize: 64, phone: { scale: 0.8, center: { x: 600, y: 540 } } });
    // The frame and the phone's place do not depend on the override.
    expect(geometry.screen).toEqual(getGeometry({ width: 390, height: 844 }, "16:9").screen);
  });

  it("puts any device's screen 640 px wide at the same place in the 9:16 frame", () => {
    // Oracle by hand: 640 / 412 = 1.5534; 915 × 1.5534 = 1421.4 -> 1421.
    const geometry = getGeometry({ width: 412, height: 915 });
    expect(geometry.frame).toEqual({ width: 1080, height: 1920 });
    expect(geometry.screen).toEqual({ left: 220, top: 214, width: 640 });
    expect(geometry.screenScale).toBeCloseTo(1.5534, 4);
    expect(geometry.screenHeight).toBe(1421);
    expect(widePose(geometry, 1)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("keeps FIRE_TRACKER's phone at 1385 px of screen height", () => {
    expect(PHONE.screenHeight).toBe(1385);
  });

  it("narrows the phone to a 900 px tall box in the middle of the 1:1 frame", () => {
    // Oracle by hand: floor(900 × 390 / 844) = 415; left = round(540 - 207.5) = 333;
    // height = round(844 × 415 / 390) = round(898.1) = 898.
    const geometry = getGeometry({ width: 390, height: 844 }, "1:1");
    expect(geometry.format).toBe("1:1");
    expect(geometry.frame).toEqual({ width: 1080, height: 1080 });
    expect(geometry.screen).toEqual({ left: 333, top: 150, width: 415 });
    expect(geometry.screenHeight).toBe(898);
    expect(geometry.cameraTarget).toEqual({ x: 540, y: 480 });
  });

  it("puts the phone on the left of the 16:9 frame and the copy on the right", () => {
    // Oracle by hand: the same 415 px screen, centred on x 600: left = round(392.5) = 393.
    const geometry = getGeometry({ width: 390, height: 844 }, "16:9");
    expect(geometry.frame).toEqual({ width: 1920, height: 1080 });
    expect(geometry.screen).toEqual({ left: 393, top: 90, width: 415 });
    expect(geometry.caption.left).toBeGreaterThan(geometry.screen.left + geometry.screen.width);
    expect(geometry.persona.left).toBe(geometry.caption.left);
    expect(geometry.endCard.left).toBe(geometry.caption.left);
  });

  it("keeps the screen inside every frame, and the 14 px bezel too outside 9:16, for the tallest device the schema accepts", () => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 100, height: 266 }, { width: 800, height: 600 }]) {
      for (const format of VIDEO_FORMATS) {
        const { frame, screen, screenHeight } = getGeometry(viewport, format);
        // 9:16 keeps MK-1's rule: only the screen must fit, the bezel of the tallest phone may cross the edge.
        const bezel = format === "9:16" ? 0 : 14;
        const label = `${format} ${String(viewport.width)}x${String(viewport.height)}`;
        expect(screen.left - bezel, label).toBeGreaterThanOrEqual(0);
        expect(screen.top - bezel, label).toBeGreaterThanOrEqual(0);
        expect(screen.left + screen.width + bezel, label).toBeLessThanOrEqual(frame.width);
        expect(screen.top + screenHeight + bezel, label).toBeLessThanOrEqual(frame.height);
      }
    }
  });

  it("returns a copy of the layout, so a caller cannot change the table", () => {
    const geometry = getGeometry({ width: 390, height: 844 }, "16:9");
    geometry.endCard.phone.center.x = 0;
    expect(getGeometry({ width: 390, height: 844 }, "16:9").endCard.phone.center.x).toBe(600);
  });
});

describe("widePose", () => {
  it("leaves the phone where the 16:9 layout puts it, left of the copy", () => {
    expect(widePose(getGeometry({ width: 390, height: 844 }, "16:9"), 1)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("fitsFrame", () => {
  it("accepts a phone and refuses a screen taller than the frame below its top edge", () => {
    // Oracle by hand: 214 + 640 × 2.66 = 1916 fits; 214 + 640 × 2.7 = 1942 does not.
    expect(fitsFrame({ width: 100, height: 266 })).toBe(true);
    expect(fitsFrame({ width: 100, height: 270 })).toBe(false);
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
