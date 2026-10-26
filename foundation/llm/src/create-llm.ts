import { err, ok, systemClock, type Clock, type Result } from "@softure-ai/core";
import type { Tracer } from "@opentelemetry/api";
import { AISDKError, generateText as sdkGenerateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import type {
  CostSource,
  LlmCallHook,
  LlmErrorCode,
  LlmUsage,
  ModelPricing,
  StructuredResult,
  TextResult,
  UsageRecord,
} from "./contract.js";
import {
  endCallSpan,
  failCallSpan,
  getDefaultTracer,
  startCallSpan,
  STRUCTURED_SPAN_NAME,
  TEXT_SPAN_NAME,
} from "./tracing.js";
import { readProviderCostUsd, resolveCost, toLlmUsage } from "./usage.js";

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
  /** Called after every finished call, failures and timeouts included, after `onUsage`; a throw propagates too. */
  readonly onCall?: LlmCallHook;
  /** Default time limit of a call, retries included. Default 30 000. */
  readonly timeoutMs?: number;
  /** Retries of a failed provider call inside the time limit. Default: the AI SDK's (2). */
  readonly maxRetries?: number;
  readonly clock?: Clock;
  /** Default: the global tracer named `@softure-ai/llm`. */
  readonly tracer?: Tracer;
}

/** What both calls share. */
interface BaseRequest {
  readonly system?: string;
  readonly prompt: string;
  /** Upper limit of output tokens; a model that stops on it yields `llm.output_truncated`. Default: the provider's. */
  readonly maxOutputTokens?: number;
  /** Overrides the default time limit for this call. */
  readonly timeoutMs?: number;
  /** Overrides the default model for this call. */
  readonly model?: LlmModel;
  /** Passed to `onUsage` and `onCall` as given (e.g. `{ accountId }`); never written to spans. */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface StructuredRequest<T> extends BaseRequest {
  /** The shape of the answer; the output is parsed and validated with it. */
  readonly schema: z.ZodType<T>;
}

export interface TextRequest extends BaseRequest {
  /** Cuts the trimmed answer to at most this many characters, at the last whitespace inside the limit. */
  readonly maxChars?: number;
}

export interface Llm {
  generateStructured<T>(request: StructuredRequest<T>): Promise<Result<StructuredResult<T>, LlmErrorCode>>;
  generateText(request: TextRequest): Promise<Result<TextResult, LlmErrorCode>>;
}

type SdkResult = Awaited<ReturnType<typeof sdkGenerateText>>;

/** `providerCostUsd`: the USD the provider reported for an answer, `null` when it reported none. */
type CallOutcome<T> =
  | {
      readonly kind: "answered";
      readonly output: T;
      readonly model: string;
      readonly usage: LlmUsage;
      readonly providerCostUsd: number | null;
    }
  | {
      readonly kind: "failed";
      readonly code: LlmErrorCode;
      readonly model?: string;
      readonly usage?: LlmUsage;
      readonly providerCostUsd?: number | null;
    }
  | { readonly kind: "timed_out" };

type Settled<T> = { readonly kind: "resolved"; readonly value: T } | { readonly kind: "rejected"; readonly error: unknown };

/** One model call as the two operations describe it to the shared call path. */
interface ModelCall<T> {
  readonly operation: "generateStructured" | "generateText";
  readonly spanName: string;
  readonly request: BaseRequest;
  /** The AI SDK's structured output setting; absent for free text. */
  readonly output?: ReturnType<typeof Output.object>;
  /** Turns a finished answer into the operation's value, or a failure code. */
  readonly readAnswer: (result: SdkResult) => { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: LlmErrorCode };
}

interface CallSuccess<T> {
  readonly output: T;
  readonly usage: LlmUsage;
  readonly model: string;
  readonly costUsd: number | null;
  readonly costSource: CostSource | null;
}

/** Creates the app's language model access. Invalid options throw a `RangeError` naming the option. */
export function createLlm(options: LlmOptions): Llm {
  assertTimeout(options.timeoutMs, "timeoutMs");
  assertMaxRetries(options.maxRetries);
  assertPricing(options.pricing ?? {});
  const clock = options.clock ?? systemClock;
  const tracer = options.tracer ?? getDefaultTracer();
  const pricing = options.pricing ?? {};

  async function runCall<T>(call: ModelCall<T>): Promise<Result<CallSuccess<T>, LlmErrorCode>> {
    const { request } = call;
    assertTimeout(request.timeoutMs, `${call.operation}: timeoutMs`);
    assertPositiveInteger(request.maxOutputTokens, `${call.operation}: maxOutputTokens`);
    const model = request.model ?? options.model;
    const { provider, modelId } = model;
    const span = startCallSpan(tracer, call.spanName, { provider, model: modelId });
    const startedAt = clock.now();

    let outcome: CallOutcome<T>;
    try {
      outcome = await callModel(call, model, request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.maxRetries);
    } catch (error) {
      failCallSpan(span, error);
      throw error;
    }

    const attributes = request.attributes ?? {};
    const report = async (ended: {
      readonly outcome: "ok" | LlmErrorCode;
      readonly model: string;
      readonly usage: LlmUsage | null;
      readonly costUsd: number | null;
      readonly costSource: CostSource | null;
    }): Promise<void> => {
      if (options.onCall === undefined) return;
      const durationMs = clock.now().getTime() - startedAt.getTime();
      await options.onCall({ operation: call.operation, provider, ...ended, startedAt, durationMs, attributes });
    };

    if (outcome.kind === "timed_out") {
      endCallSpan(span, { code: "llm.timeout" });
      await report({ outcome: "llm.timeout", model: modelId, usage: null, costUsd: null, costSource: null });
      return err("llm.timeout");
    }
    const answeredModel = outcome.model ?? modelId;
    const { costUsd, costSource } = resolveCost({
      pricing,
      model: answeredModel,
      usage: outcome.usage,
      providerCostUsd: outcome.providerCostUsd ?? null,
    });
    const code = outcome.kind === "answered" ? "ok" : outcome.code;
    endCallSpan(span, { code, model: answeredModel, usage: outcome.usage, costUsd, costSource });

    if (outcome.usage !== undefined && options.onUsage !== undefined) {
      await options.onUsage({
        model: answeredModel,
        provider,
        usage: outcome.usage,
        costUsd,
        costSource,
        outcome: code,
        durationMs: clock.now().getTime() - startedAt.getTime(),
        at: startedAt,
        attributes,
      });
    }
    await report({ outcome: code, model: answeredModel, usage: outcome.usage ?? null, costUsd, costSource });

    if (outcome.kind === "failed") return err(outcome.code);
    return ok({ output: outcome.output, usage: outcome.usage, model: answeredModel, costUsd, costSource });
  }

  async function generateStructured<T>(request: StructuredRequest<T>): Promise<Result<StructuredResult<T>, LlmErrorCode>> {
    return runCall<T>({
      operation: "generateStructured",
      spanName: STRUCTURED_SPAN_NAME,
      request,
      output: Output.object({ schema: request.schema }),
      // The schema above validated the output; the SDK types it from the schema it was given.
      readAnswer: (result) => ({ ok: true, value: result.output as T }),
    });
  }

  async function generateText(request: TextRequest): Promise<Result<TextResult, LlmErrorCode>> {
    assertPositiveInteger(request.maxChars, "generateText: maxChars");
    const result = await runCall({
      operation: "generateText",
      spanName: TEXT_SPAN_NAME,
      request,
      readAnswer: (answer) => {
        const text = answer.text.trim();
        if (text === "") return { ok: false, code: "llm.invalid_output" };
        return { ok: true, value: cutText(text, request.maxChars) };
      },
    });
    if (!result.ok) return result;
    const { output, ...rest } = result.value;
    return ok({ text: output.text, truncated: output.truncated, ...rest });
  }

  return { generateStructured, generateText };
}

/** Runs the AI SDK call under a time limit. Rejects only with an error that is not the AI SDK's (a bug). */
async function callModel<T>(
  call: ModelCall<T>,
  model: LlmModel,
  timeoutMs: number,
  maxRetries: number | undefined,
): Promise<CallOutcome<T>> {
  const { request } = call;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<{ readonly kind: "timed_out" }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new DOMException(`The model call exceeded ${String(timeoutMs)} ms`, "TimeoutError"));
      resolve({ kind: "timed_out" });
    }, timeoutMs);
  });
  // Settled into a value before the race, so a rejection after the timeout is never unhandled.
  const pending: Promise<Settled<SdkResult>> = sdkGenerateText({
    model,
    ...(call.output === undefined ? {} : { output: call.output }),
    ...(request.system === undefined ? {} : { system: request.system }),
    prompt: request.prompt,
    ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
    abortSignal: controller.signal,
    ...(maxRetries === undefined ? {} : { maxRetries }),
  }).then(
    (value) => ({ kind: "resolved", value }),
    (error: unknown) => ({ kind: "rejected", error }),
  );

  let settled: Settled<SdkResult> | { readonly kind: "timed_out" };
  try {
    settled = await Promise.race([pending, timedOut]);
  } finally {
    clearTimeout(timer);
  }

  if (settled.kind === "timed_out" || controller.signal.aborted) return { kind: "timed_out" };
  if (settled.kind === "rejected") return classifyFailure(settled.error);

  const answer = settled.value;
  const answeredModel = answer.response.modelId;
  const usage = toLlmUsage(answer.totalUsage);
  const providerCostUsd = readProviderCostUsd(answer.providerMetadata);
  const answered = { model: answeredModel, usage, providerCostUsd };
  if (answer.finishReason === "length") return { kind: "failed", code: "llm.output_truncated", ...answered };
  const read = call.readAnswer(answer);
  if (!read.ok) return { kind: "failed", code: read.code, ...answered };
  return { kind: "answered", output: read.value, ...answered };
}

function classifyFailure(error: unknown): CallOutcome<never> {
  if (NoObjectGeneratedError.isInstance(error)) {
    const code = error.finishReason === "length" ? "llm.output_truncated" : "llm.invalid_output";
    return { kind: "failed", code, model: error.response?.modelId, usage: toLlmUsage(error.usage) };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return { kind: "timed_out" };
  if (AISDKError.isInstance(error)) return { kind: "failed", code: "llm.unavailable" };
  throw error;
}

/** Cuts `text` to at most `maxChars` characters (code points), at the last whitespace when there is one. */
function cutText(text: string, maxChars: number | undefined): { readonly text: string; readonly truncated: boolean } {
  const chars = Array.from(text);
  if (maxChars === undefined || chars.length <= maxChars) return { text, truncated: false };
  const head = chars.slice(0, maxChars).join("");
  if (/\s/.test(chars[maxChars] ?? "")) return { text: head.trimEnd(), truncated: true };
  const lastSpace = head.search(/\s\S*$/);
  return { text: lastSpace > 0 ? head.slice(0, lastSpace).trimEnd() : head, truncated: true };
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

function assertPositiveInteger(value: number | undefined, name: string): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`createLlm: ${name} must be a whole number of 1 or more`);
}
