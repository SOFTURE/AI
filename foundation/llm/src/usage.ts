import type { LanguageModelUsage } from "ai";
import type { CostSource, LlmUsage, ModelPricing } from "./contract.js";

const TOKENS_PER_MILLION = 1_000_000;

/** Turns the AI SDK's usage (counts may be missing) into plain numbers. */
export function toLlmUsage(usage: LanguageModelUsage | undefined): LlmUsage {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage?.totalTokens ?? inputTokens + outputTokens,
    cachedInputTokens: usage?.inputTokenDetails.cacheReadTokens ?? 0,
    reasoningTokens: usage?.outputTokenDetails.reasoningTokens ?? 0,
  };
}

/** The cost of a call in USD, or `null` when the model has no price. Cached input uses its own price when given. */
export function getCostUsd(pricing: ModelPricing, model: string, usage: LlmUsage): number | null {
  const price = pricing[model];
  if (price === undefined) return null;
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const cachedPrice = price.cachedInputPerMillion ?? price.inputPerMillion;
  const costPerMillion =
    (usage.inputTokens - cached) * price.inputPerMillion + cached * cachedPrice + usage.outputTokens * price.outputPerMillion;
  return costPerMillion / TOKENS_PER_MILLION;
}

/** The USD the provider reported it billed for the call, or `null` when it reported none (or nothing usable). */
export function readProviderCostUsd(providerMetadata: unknown): number | null {
  const cost = readPath(providerMetadata, ["openrouter", "usage", "cost"]);
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) return null;
  return cost;
}

/** The call's cost and where it came from: the provider's figure first, then the price table. */
export function resolveCost(input: {
  readonly pricing: ModelPricing;
  readonly model: string;
  readonly usage: LlmUsage | undefined;
  readonly providerCostUsd: number | null;
}): { readonly costUsd: number | null; readonly costSource: CostSource | null } {
  if (input.providerCostUsd !== null) return { costUsd: input.providerCostUsd, costSource: "provider" };
  const costUsd = input.usage === undefined ? null : getCostUsd(input.pricing, input.model, input.usage);
  return { costUsd, costSource: costUsd === null ? null : "price_table" };
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
