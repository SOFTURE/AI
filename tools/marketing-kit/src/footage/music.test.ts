import { describe, expect, it } from "vitest";

import type { TimedWord } from "../voice/voiceover.js";
import { duckingKeyframes, getSpeechSpans, volumeExpression } from "./music.js";

const w = (start: number, end: number): TimedWord => ({ text: "word", start, end });

describe("getSpeechSpans", () => {
  it("joins words closer than the gap", () => {
    expect(getSpeechSpans([w(1, 1.3), w(1.5, 2), w(4, 4.5)], 0.6)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4.5 },
    ]);
  });
});

describe("duckingKeyframes", () => {
  it("is loud without speech", () => {
    expect(duckingKeyframes([], { volume: 0.35, duckedVolume: 0.1 })).toEqual([{ t: 0, volume: 0.35 }]);
  });

  it("ducks under each stretch of speech and comes back after it", () => {
    expect(duckingKeyframes([w(2, 3), w(6, 7)], { volume: 0.4, duckedVolume: 0.1 })).toEqual([
      { t: 0, volume: 0.4 },
      { t: 1.75, volume: 0.4 },
      { t: 2, volume: 0.1 },
      { t: 3, volume: 0.1 },
      { t: 3.5, volume: 0.4 },
      { t: 5.75, volume: 0.4 },
      { t: 6, volume: 0.1 },
      { t: 7, volume: 0.1 },
      { t: 7.5, volume: 0.4 },
    ]);
  });

  it("starts ducked when the film opens on a word", () => {
    expect(duckingKeyframes([w(0.1, 1)], { volume: 0.4, duckedVolume: 0.1 }).slice(0, 2)).toEqual([
      { t: 0, volume: 0.4 },
      { t: 0.1, volume: 0.1 },
    ]);
  });

  it("stays down between stretches too close for the music to come back", () => {
    const keyframes = duckingKeyframes([w(1, 2), w(2.6, 3)], { volume: 0.4, duckedVolume: 0.1 });
    expect(keyframes.filter((keyframe) => keyframe.volume === 0.1)).toEqual([
      { t: 1, volume: 0.1 },
      { t: 3, volume: 0.1 },
    ]);
  });
});

describe("volumeExpression", () => {
  it("writes the keyframes as a sum of windowed linear pieces", () => {
    expect(
      volumeExpression([
        { t: 0, volume: 0.4 },
        { t: 1, volume: 0.4 },
        { t: 1.5, volume: 0.1 },
      ]),
    ).toBe("lt(t,0)*0.4+gte(t,0)*lt(t,1)*0.4+gte(t,1)*lt(t,1.5)*(0.4+-0.6*(t-1))+gte(t,1.5)*0.1");
  });

  it("is full volume without keyframes", () => {
    expect(volumeExpression([])).toBe("1");
  });
});
