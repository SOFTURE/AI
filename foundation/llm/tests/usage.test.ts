import { describe, expect, it } from "vitest";
import { getCostUsd } from "../src/index.js";
import { toLlmUsage } from "../src/usage.js";

const usage = { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, cachedInputTokens: 400, reasoningTokens: 0 };

describe("getCostUsd", () => {
  it("bills cached input tokens at the cached price when the model has one", () => {
    const cost = getCostUsd({ m: { inputPerMillion: 2, outputPerMillion: 8, cachedInputPerMillion: 0.5 } }, "m", usage);

    // 600 × 2 + 400 × 0.5 + 500 × 8 = 5 400 per million tokens.
    expect(cost).toBeCloseTo(0.0054, 10);
  });

  it("bills cached input tokens at the input price when the model has no cached price", () => {
    const cost = getCostUsd({ m: { inputPerMillion: 2, outputPerMillion: 8 } }, "m", usage);

    expect(cost).toBeCloseTo(0.006, 10);
  });

  it("returns null for a model without a price", () => {
    expect(getCostUsd({ other: { inputPerMillion: 1, outputPerMillion: 1 } }, "m", usage)).toBeNull();
  });

  it("returns 0 for a call without tokens", () => {
    const empty = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 };

    expect(getCostUsd({ m: { inputPerMillion: 2, outputPerMillion: 8 } }, "m", empty)).toBe(0);
  });
});

describe("toLlmUsage", () => {
  it("reads 0 for every count the provider left out", () => {
    expect(
      toLlmUsage({
        inputTokens: undefined,
        inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
        outputTokens: undefined,
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        totalTokens: undefined,
      }),
    ).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 });
  });

  it("sums input and output when the provider gives no total", () => {
    const result = toLlmUsage({
      inputTokens: 7,
      inputTokenDetails: { noCacheTokens: 7, cacheReadTokens: 2, cacheWriteTokens: 0 },
      outputTokens: 3,
      outputTokenDetails: { textTokens: 2, reasoningTokens: 1 },
      totalTokens: undefined,
    });

    expect(result).toEqual({ inputTokens: 7, outputTokens: 3, totalTokens: 10, cachedInputTokens: 2, reasoningTokens: 1 });
  });
});
