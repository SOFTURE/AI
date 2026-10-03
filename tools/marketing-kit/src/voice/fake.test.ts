import { describe, expect, it } from "vitest";

import { createFakeTtsProvider } from "./fake.js";

const input = { text: " Anna  has a cat. ", voiceId: "v", model: "m", language: "en" };

describe("createFakeTtsProvider", () => {
  it("times one word per whitespace-separated token, evenly spaced", async () => {
    const result = await createFakeTtsProvider({ wordSeconds: 0.5 }).synthesize(input);
    expect(result.ok && result.value.words).toEqual([
      { text: "Anna", start: 0, end: 0.5 },
      { text: "has", start: 0.55, end: 1.05 },
      { text: "a", start: 1.1, end: 1.6 },
      { text: "cat.", start: 1.65, end: 2.15 },
    ]);
  });

  it("gives the same recording for the same input and records every call", async () => {
    const provider = createFakeTtsProvider();
    const first = await provider.synthesize(input);
    const second = await provider.synthesize(input);
    expect(second).toEqual(first);
    expect(provider.calls).toEqual([input, input]);
  });

  it("fails on request, for error-path tests", async () => {
    expect(await createFakeTtsProvider({ failWith: "quota exceeded" }).synthesize(input)).toEqual({ ok: false, error: "quota exceeded" });
  });

  it("estimates nothing to pay", () => {
    expect(createFakeTtsProvider().estimate(input)).toEqual({ characters: 18, maxCost: 0, unit: "fake credits" });
  });
});
