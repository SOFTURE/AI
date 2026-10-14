import type { LanguageModelUsage } from "ai";
import type { LlmUsage, ModelPricing } from "./contract.js";

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
