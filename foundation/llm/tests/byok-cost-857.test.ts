// Issue #857: the provider's cost includes the upstream cost of a BYOK call, and a provider total of 0 falls back to
// the price table when the model has a price.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlm, type ModelPricing } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const scoreSchema = z.object({ score: z.number() });
const PRICING = { small: { inputPerMillion: 1, outputPerMillion: 4 } };
const PRICE_TABLE_COST = 0.00003;
const openrouterUsage = (usage: Record<string, unknown>) => ({ openrouter: { usage } }) as never;

async function getCost(providerMetadata: unknown, pricing: ModelPricing = PRICING): Promise<unknown> {
  const model = fakeModel({ modelId: "small" }, { kind: "output", value: { score: 1 }, providerMetadata: providerMetadata as never });
  const result = await createLlm({ model, pricing }).generateStructured({ schema: scoreSchema, prompt: "Text" });
  return result.ok && [result.value.costUsd, result.value.costSource];
}

describe("the cost of a BYOK call", () => {
  it("is the upstream cost when OpenRouter's fee is 0", async () => {
    const cost = await getCost(openrouterUsage({ cost: 0, costDetails: { upstreamInferenceCost: 0.0021 } }));

    expect(cost).toEqual([0.0021, "provider"]);
  });

  it("adds OpenRouter's fee to the upstream cost", async () => {
    const cost = await getCost(openrouterUsage({ cost: 0.0005, costDetails: { upstreamInferenceCost: 0.002 } }));

    expect(cost).toEqual([0.0025, "provider"]);
  });

  it("takes the upstream cost when the fee is missing", async () => {
    const cost = await getCost(openrouterUsage({ costDetails: { upstreamInferenceCost: 0.0021 } }));

    expect(cost).toEqual([0.0021, "provider"]);
  });

  it("skips an unusable upstream cost next to a usable fee", async () => {
    const costs = await Promise.all(
      ["0.1", -1, Number.NaN, null].map((upstreamInferenceCost) =>
        getCost(openrouterUsage({ cost: 0.0042, costDetails: { upstreamInferenceCost } })),
      ),
    );

    expect(costs).toEqual(Array.from({ length: 4 }, () => [0.0042, "provider"]));
  });
});

describe("a provider total of 0", () => {
  it("falls back to the price table when the model has a price", async () => {
    const costs = await Promise.all([
      getCost(openrouterUsage({ cost: 0 })),
      getCost(openrouterUsage({ cost: 0, costDetails: { upstreamInferenceCost: 0 } })),
    ]);

    expect(costs).toEqual([
      [PRICE_TABLE_COST, "price_table"],
      [PRICE_TABLE_COST, "price_table"],
    ]);
  });

  it("stays 0 from the provider for a model without a price", async () => {
    const cost = await getCost(openrouterUsage({ cost: 0 }), {});

    expect(cost).toEqual([0, "provider"]);
  });
});
