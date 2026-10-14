import { err, ok, systemClock, type Clock, type Result } from "@softure-ai/core";
import type { Tracer } from "@opentelemetry/api";
import { AISDKError, generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import type { LlmErrorCode, LlmUsage, ModelPricing, StructuredResult, UsageRecord } from "./contract.js";
import { endCallSpan, failCallSpan, getDefaultTracer, startCallSpan } from "./tracing.js";
import { getCostUsd, toLlmUsage } from "./usage.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * A model object built with an AI SDK provider. A bare model id (the SDK's gateway) is not accepted: the gateway
 * throws errors of its own package, and the app picks its provider explicitly.
 */
export type LlmModel = Exclude<LanguageModel, string>;

export interface LlmOptions {
  /** The model the app built with an AI SDK provider, e.g. `createOpenRouter({ apiKey })("openai/gpt-5-mini")`. */
  readonly model: LlmModel;
  /** Model id → USD per million tokens; a model without an entry has `costUsd: null`. */
  readonly pricing?: ModelPricing;
  /** Called after every call that reached the model and reported usage; a throw propagates to the caller. */
  readonly onUsage?: (record: UsageRecord) => void | Promise<void>;
  /** Default time limit of a call, retries included. Default 30 000. */
  readonly timeoutMs?: number;
  /** Retries of a failed provider call inside the time limit. Default: the AI SDK's (2). */
  readonly maxRetries?: number;
  readonly clock?: Clock;
  /** Default: the global tracer named `@softure-ai/llm`. */
  readonly tracer?: Tracer;
}

export interface StructuredRequest<T> {
  /** The shape of the answer; the output is parsed and validated with it. */
  readonly schema: z.ZodType<T>;
  readonly system?: string;
  readonly prompt: string;
  /** Overrides the default time limit for this call. */
  readonly timeoutMs?: number;
  /** Overrides the default model for this call. */
  readonly model?: LlmModel;
  /** Passed to `onUsage` as given (e.g. `{ accountId }`); never written to spans. */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface Llm {
  generateStructured<T>(request: StructuredRequest<T>): Promise<Result<StructuredResult<T>, LlmErrorCode>>;
}

type CallOutcome<T> =
  | { readonly kind: "answered"; readonly output: T; readonly model: string; readonly usage: LlmUsage }
  | { readonly kind: "failed"; readonly code: LlmErrorCode; readonly model?: string; readonly usage?: LlmUsage }
  | { readonly kind: "timed_out" };

type Settled<T> = { readonly kind: "resolved"; readonly value: T } | { readonly kind: "rejected"; readonly error: unknown };

/** Creates the app's language model access. Invalid options throw a `RangeError` naming the option. */
export function createLlm(options: LlmOptions): Llm {
  assertTimeout(options.timeoutMs, "timeoutMs");
  assertMaxRetries(options.maxRetries);
  assertPricing(options.pricing ?? {});
  const clock = options.clock ?? systemClock;
  const tracer = options.tracer ?? getDefaultTracer();
  const pricing = options.pricing ?? {};

  async function generateStructured<T>(request: StructuredRequest<T>): Promise<Result<StructuredResult<T>, LlmErrorCode>> {
    assertTimeout(request.timeoutMs, "generateStructured: timeoutMs");
    const model = request.model ?? options.model;
    const { provider, modelId } = model;
    const span = startCallSpan(tracer, { provider, model: modelId });
    const startedAt = clock.now();

    let outcome: CallOutcome<T>;
    try {
      outcome = await callModel(request, model, request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.maxRetries);
    } catch (error) {
      failCallSpan(span, error);
      throw error;
    }

    if (outcome.kind === "timed_out") {
      endCallSpan(span, { code: "llm.timeout" });
      return err("llm.timeout");
    }
    const answeredModel = outcome.model ?? modelId;
    const costUsd = outcome.usage === undefined ? null : getCostUsd(pricing, answeredModel, outcome.usage);
    const code = outcome.kind === "answered" ? "ok" : outcome.code;
    endCallSpan(span, { code, model: answeredModel, usage: outcome.usage, costUsd });

    if (outcome.usage !== undefined && options.onUsage !== undefined) {
      await options.onUsage({
        model: answeredModel,
        provider,
        usage: outcome.usage,
        costUsd,
        outcome: code,
        durationMs: clock.now().getTime() - startedAt.getTime(),
        at: startedAt,
        attributes: request.attributes ?? {},
      });
    }

    if (outcome.kind === "failed") return err(outcome.code);
    return ok({ output: outcome.output, usage: outcome.usage, model: answeredModel, costUsd });
  }

  return { generateStructured };
}

/** Runs the AI SDK call under a time limit. Rejects only with an error that is not the AI SDK's (a bug). */
async function callModel<T>(
  request: StructuredRequest<T>,
  model: LlmModel,
  timeoutMs: number,
  maxRetries: number | undefined,
): Promise<CallOutcome<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<{ readonly kind: "timed_out" }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new DOMException(`The model call exceeded ${String(timeoutMs)} ms`, "TimeoutError"));
      resolve({ kind: "timed_out" });
    }, timeoutMs);
  });
  // Settled into a value before the race, so a rejection after the timeout is never unhandled.
  const call: Promise<Settled<Awaited<ReturnType<typeof generateText>>>> = generateText({
    model,
    output: Output.object({ schema: request.schema }),
    ...(request.system === undefined ? {} : { system: request.system }),
    prompt: request.prompt,
    abortSignal: controller.signal,
    ...(maxRetries === undefined ? {} : { maxRetries }),
  }).then(
    (value) => ({ kind: "resolved", value }),
    (error: unknown) => ({ kind: "rejected", error }),
  );

  let settled: Settled<Awaited<ReturnType<typeof generateText>>> | { readonly kind: "timed_out" };
  try {
    settled = await Promise.race([call, timedOut]);
  } finally {
    clearTimeout(timer);
  }

  if (settled.kind === "timed_out" || controller.signal.aborted) return { kind: "timed_out" };
  if (settled.kind === "resolved") {
    return {
      kind: "answered",
      // The schema above validated the output; the SDK types it from the schema it was given.
      output: settled.value.output as T,
      model: settled.value.response.modelId,
      usage: toLlmUsage(settled.value.totalUsage),
    };
  }
  return classifyFailure(settled.error);
}

function classifyFailure(error: unknown): CallOutcome<never> {
  if (NoObjectGeneratedError.isInstance(error)) {
    return { kind: "failed", code: "llm.invalid_output", model: error.response?.modelId, usage: toLlmUsage(error.usage) };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return { kind: "timed_out" };
  if (AISDKError.isInstance(error)) return { kind: "failed", code: "llm.unavailable" };
  throw error;
}

function assertTimeout(value: number | undefined, name: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`createLlm: ${name} must be a positive number of milliseconds`);
}

function assertMaxRetries(value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 0) throw new RangeError("createLlm: maxRetries must be a whole number of 0 or more");
}

function assertPricing(pricing: ModelPricing): void {
  for (const [model, price] of Object.entries(pricing)) {
    const values = [price.inputPerMillion, price.outputPerMillion, price.cachedInputPerMillion ?? 0];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new RangeError(`createLlm: pricing["${model}"] must hold prices of 0 or more`);
    }
  }
}
