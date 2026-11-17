// Embeddings: one way for an app to turn texts into vectors for search, over an AI SDK embedding model, with the same
// time limit, stable error codes, usage and cost records and spans as the text calls. The model object comes from the
// app: an AI SDK provider, or one of the two adapters of this package (`workersAiEmbeddingModel` on Cloudflare,
// `openAiCompatibleEmbeddingModel` for any OpenAI-compatible endpoint).
import { err, ok, systemClock, type Clock, type Result } from "@softure-ai/core";
import type { Tracer } from "@opentelemetry/api";
import { AISDKError, embedMany, type EmbeddingModel } from "ai";
import type { CostSource, LlmCallHook, LlmErrorCode, LlmUsage, ModelPricing, UsageRecord } from "./contract.js";
import { EMBED_SPAN_NAME, endCallSpan, failCallSpan, getDefaultTracer, startCallSpan } from "./tracing.js";
import { getCostUsd } from "./usage.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/** An embedding model object built by a provider; a bare model id (the SDK's gateway) is not accepted. */
export type EmbedderModel = Exclude<EmbeddingModel, string>;

export interface EmbedderOptions {
  readonly model: EmbedderModel;
  /**
   * The length every vector must have (the app's vector column). A model that answers with another length fails the
   * call with `llm.invalid_output`, so a misconfigured model never writes vectors that cannot be compared.
   */
  readonly dimensions: number;
  /** Model id → USD per million input tokens (`outputPerMillion` is ignored); without an entry `costUsd` is `null`. */
  readonly pricing?: ModelPricing;
  readonly onUsage?: (record: UsageRecord) => void | Promise<void>;
  readonly onCall?: LlmCallHook;
  /** Time limit of one `embedTexts`, every batch and retry included. Default 30 000. */
  readonly timeoutMs?: number;
  /** Retries of a failed provider call inside the time limit. Default: the AI SDK's (2). */
  readonly maxRetries?: number;
  readonly clock?: Clock;
  readonly tracer?: Tracer;
}

export interface EmbedRequest {
  /** The texts, in order; the answer holds one vector per text in the same order. Empty: no call, no vectors. */
  readonly values: readonly string[];
  readonly timeoutMs?: number;
  /** Passed to `onUsage` and `onCall` as given (e.g. `{ accountId }`); never written to spans. */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface EmbedResult {
  readonly embeddings: readonly (readonly number[])[];
  /** Input tokens in `inputTokens` and `totalTokens`; 0 when the provider reported none. */
  readonly usage: LlmUsage;
  readonly model: string;
  readonly costUsd: number | null;
  readonly costSource: CostSource | null;
}

export interface Embedder {
  /** The model id vectors come from: store it next to them, so a change of model can be seen and re-embedded. */
  readonly modelId: string;
  readonly dimensions: number;
  embedTexts(request: EmbedRequest): Promise<Result<EmbedResult, LlmErrorCode>>;
}

type EmbedOutcome =
  | { readonly kind: "answered"; readonly embeddings: number[][]; readonly tokens: number }
  | { readonly kind: "failed"; readonly code: LlmErrorCode; readonly tokens?: number }
  | { readonly kind: "timed_out" };

/** Creates the app's embedding access. Invalid options throw a `RangeError` naming the option. */
export function createEmbedder(options: EmbedderOptions): Embedder {
  assertPositiveInteger(options.dimensions, "dimensions");
  assertTimeout(options.timeoutMs, "timeoutMs");
  if (options.maxRetries !== undefined && (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)) {
    throw new RangeError("createEmbedder: maxRetries must be a whole number of 0 or more");
  }
  const pricing = options.pricing ?? {};
  for (const [model, price] of Object.entries(pricing)) {
    if (!Number.isFinite(price.inputPerMillion) || price.inputPerMillion < 0) {
      throw new RangeError(`createEmbedder: pricing["${model}"] must hold prices of 0 or more`);
    }
  }
  const clock = options.clock ?? systemClock;
  const tracer = options.tracer ?? getDefaultTracer();
  const { provider, modelId } = options.model;

  async function embedTexts(request: EmbedRequest): Promise<Result<EmbedResult, LlmErrorCode>> {
    assertTimeout(request.timeoutMs, "embedTexts: timeoutMs");
    if (request.values.length === 0) {
      return ok({ embeddings: [], usage: toUsage(0), model: modelId, costUsd: null, costSource: null });
    }
    const span = startCallSpan(tracer, EMBED_SPAN_NAME, { provider, model: modelId, operation: "embeddings" });
    const startedAt = clock.now();
    let outcome: EmbedOutcome;
    try {
      outcome = await callEmbeddings({
        model: options.model,
        values: [...request.values],
        timeoutMs: request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: options.maxRetries,
      });
    } catch (error) {
      failCallSpan(span, error);
      throw error;
    }
    if (outcome.kind === "answered" && !hasDimensions(outcome.embeddings, options.dimensions, request.values.length)) {
      outcome = { kind: "failed", code: "llm.invalid_output", tokens: outcome.tokens };
    }
    const durationMs = clock.now().getTime() - startedAt.getTime();
    const attributes = request.attributes ?? {};
    const code = outcome.kind === "answered" ? "ok" : outcome.kind === "timed_out" ? "llm.timeout" : outcome.code;
    const tokens = outcome.kind === "timed_out" ? undefined : outcome.tokens;
    const usage = tokens === undefined ? undefined : toUsage(tokens);
    const costUsd = usage === undefined ? null : getCostUsd(pricing, modelId, usage);
    const costSource: CostSource | null = costUsd === null ? null : "price_table";
    endCallSpan(span, { code, model: modelId, ...(usage === undefined ? {} : { usage }), costUsd, costSource });
    if (usage !== undefined && options.onUsage !== undefined) {
      await options.onUsage({ model: modelId, provider, usage, costUsd, costSource, outcome: code, durationMs, at: startedAt, attributes });
    }
    if (options.onCall !== undefined) {
      await options.onCall({
        operation: "embedTexts",
        model: modelId,
        provider,
        outcome: code,
        usage: usage ?? null,
        costUsd,
        costSource,
        startedAt,
        durationMs,
        attributes,
      });
    }
    if (outcome.kind !== "answered") return err(code === "ok" ? "llm.unavailable" : code);
    return ok({ embeddings: outcome.embeddings, usage: toUsage(outcome.tokens), model: modelId, costUsd, costSource });
  }

  return { modelId, dimensions: options.dimensions, embedTexts };
}

type Settled = { readonly kind: "resolved"; readonly value: Awaited<ReturnType<typeof embedMany>> } | { readonly kind: "rejected"; readonly error: unknown };

/** Runs `embedMany` under a time limit. Rejects only with an error that is not the AI SDK's (a bug). */
async function callEmbeddings(input: {
  readonly model: EmbedderModel;
  readonly values: string[];
  readonly timeoutMs: number;
  readonly maxRetries: number | undefined;
}): Promise<EmbedOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<{ readonly kind: "timed_out" }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new DOMException(`The embedding call exceeded ${String(input.timeoutMs)} ms`, "TimeoutError"));
      resolve({ kind: "timed_out" });
    }, input.timeoutMs);
  });
  const pending: Promise<Settled> = embedMany({
    model: input.model,
    values: input.values,
    abortSignal: controller.signal,
    ...(input.maxRetries === undefined ? {} : { maxRetries: input.maxRetries }),
  }).then(
    (value) => ({ kind: "resolved" as const, value }),
    (error: unknown) => ({ kind: "rejected" as const, error }),
  );
  let settled: Settled | { readonly kind: "timed_out" };
  try {
    settled = await Promise.race([pending, timedOut]);
  } finally {
    clearTimeout(timer);
  }
  if (settled.kind === "timed_out" || controller.signal.aborted) return { kind: "timed_out" };
  if (settled.kind === "rejected") {
    if (settled.error instanceof DOMException && settled.error.name === "TimeoutError") return { kind: "timed_out" };
    if (AISDKError.isInstance(settled.error)) return { kind: "failed", code: "llm.unavailable" };
    throw settled.error;
  }
  return { kind: "answered", embeddings: settled.value.embeddings, tokens: settled.value.usage.tokens };
}

function hasDimensions(embeddings: readonly (readonly number[])[], dimensions: number, count: number): boolean {
  return (
    embeddings.length === count &&
    embeddings.every((vector) => vector.length === dimensions && vector.every((value) => typeof value === "number" && Number.isFinite(value)))
  );
}

function toUsage(tokens: number): LlmUsage {
  return { inputTokens: tokens, outputTokens: 0, totalTokens: tokens, cachedInputTokens: 0, reasoningTokens: 0 };
}

function assertTimeout(value: number | undefined, name: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`createEmbedder: ${name} must be a positive number of milliseconds`);
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`createEmbedder: ${name} must be a whole number of 1 or more`);
}
