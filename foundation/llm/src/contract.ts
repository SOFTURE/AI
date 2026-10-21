// Error codes and the shapes an app reads back from @softure-ai/llm. No copy: the app translates codes itself.

/** Every expected failure of a call, as a stable code. */
export const LLM_ERROR_CODES = ["llm.unavailable", "llm.invalid_output", "llm.output_truncated", "llm.timeout"] as const;

/**
 * - `llm.unavailable`: the provider failed (HTTP error, network, missing key, retries exhausted);
 * - `llm.invalid_output`: the model answered, but not with JSON matching the schema (or, for text, with nothing);
 * - `llm.output_truncated`: the model stopped on the output token limit before finishing its answer;
 * - `llm.timeout`: no answer within `timeoutMs`.
 */
export type LlmErrorCode = (typeof LLM_ERROR_CODES)[number];

/** Token counts of one call; `0` where the provider reported nothing. */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  /** Input tokens read from the provider's prompt cache (a part of `inputTokens`). */
  readonly cachedInputTokens: number;
  /** Output tokens spent on reasoning (a part of `outputTokens`). */
  readonly reasoningTokens: number;
}

/** Prices of one model in USD per million tokens. */
export interface ModelPrice {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
  /** Price of cached input tokens; without it they cost `inputPerMillion`. */
  readonly cachedInputPerMillion?: number;
}

/** Model id (as the provider reports it) → price. */
export type ModelPricing = Readonly<Record<string, ModelPrice>>;

/** What `onUsage` receives after every call that reached the model and reported usage. */
export interface UsageRecord {
  /** The model id the provider answered with. */
  readonly model: string;
  readonly provider: string;
  readonly usage: LlmUsage;
  /** `null` when `pricing` has no entry for the model. */
  readonly costUsd: number | null;
  readonly outcome: "ok" | LlmErrorCode;
  readonly durationMs: number;
  readonly at: Date;
  /** The call's `attributes`, e.g. `{ accountId }`. */
  readonly attributes: Readonly<Record<string, string>>;
}

/** The value of a successful `generateStructured`. */
export interface StructuredResult<T> {
  readonly output: T;
  readonly usage: LlmUsage;
  readonly model: string;
  readonly costUsd: number | null;
}

/** The value of a successful `generateText`. */
export interface TextResult {
  /** The answer without surrounding whitespace, cut to `maxChars` when given. */
  readonly text: string;
  /** `true` when `maxChars` cut the answer. */
  readonly truncated: boolean;
  readonly usage: LlmUsage;
  readonly model: string;
  readonly costUsd: number | null;
}
