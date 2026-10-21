// Test double for code that calls @softure-ai/llm: an AI SDK model that answers from a script.
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const DEFAULT_MODEL_ID = "fake-model";
const DEFAULT_USAGE: FakeUsage = { inputTokens: 10, outputTokens: 5 };

export interface FakeUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}

/** One scripted answer. `usage` defaults to 10 input and 5 output tokens. */
export type FakeResponse =
  /** Answers with `value` serialised to JSON. */
  | { readonly kind: "output"; readonly value: unknown; readonly usage?: FakeUsage }
  /** Answers with raw text: the answer of `generateText`, or not JSON to provoke `llm.invalid_output`. */
  | { readonly kind: "text"; readonly text: string; readonly usage?: FakeUsage }
  /** Stops on the output token limit after `text` (default empty), to provoke `llm.output_truncated`. */
  | { readonly kind: "truncated"; readonly text?: string; readonly usage?: FakeUsage }
  /** Fails like a provider returning HTTP 503 (`llm.unavailable`). */
  | { readonly kind: "unavailable" }
  /** Never answers; ends only when the call is aborted (`llm.timeout`). */
  | { readonly kind: "hang" };

export interface FakeModelOptions {
  readonly modelId?: string;
  readonly provider?: string;
}

/** An AI SDK model; `doGenerateCalls` lists what each call sent (prompt, response format, abort signal). */
export type FakeModel = MockLanguageModelV4;

/**
 * A model that answers call N with `responses[N]`; the last response repeats. Pass it to `createLlm({ model })`.
 * `fakeModel({ kind: "output", value: { score: 3 } })`.
 */
export function fakeModel(...responses: [FakeResponse, ...FakeResponse[]]): FakeModel;
export function fakeModel(options: FakeModelOptions, ...responses: [FakeResponse, ...FakeResponse[]]): FakeModel;
export function fakeModel(...args: [FakeModelOptions | FakeResponse, ...FakeResponse[]]): FakeModel {
  const [first, ...rest] = args;
  const options: FakeModelOptions = isResponse(first) ? {} : first;
  const responses: FakeResponse[] = isResponse(first) ? [first, ...rest] : rest;
  if (responses.length === 0) throw new RangeError("fakeModel: pass at least one response");
  let callCount = 0;

  return new MockLanguageModelV4({
    modelId: options.modelId ?? DEFAULT_MODEL_ID,
    ...(options.provider === undefined ? {} : { provider: options.provider }),
    doGenerate: async ({ abortSignal }) => {
      const response = responses[Math.min(callCount, responses.length - 1)];
      callCount += 1;
      // `responses` is non-empty and the index is clamped to it.
      return answer(response!, options.modelId ?? DEFAULT_MODEL_ID, abortSignal);
    },
  });
}

function isResponse(value: FakeModelOptions | FakeResponse): value is FakeResponse {
  return "kind" in value;
}

async function answer(response: FakeResponse, modelId: string, abortSignal: AbortSignal | undefined) {
  switch (response.kind) {
    case "output":
      return toResult(JSON.stringify(response.value), modelId, response.usage ?? DEFAULT_USAGE);
    case "text":
      return toResult(response.text, modelId, response.usage ?? DEFAULT_USAGE);
    case "truncated":
      return toResult(response.text ?? "", modelId, response.usage ?? DEFAULT_USAGE, "length");
    case "unavailable":
      throw new APICallError({
        message: "fakeModel: the provider is unavailable",
        url: "https://fake-model.invalid/v1",
        requestBodyValues: {},
        statusCode: 503,
        isRetryable: false,
      });
    case "hang":
      return new Promise<never>((_resolve, reject) => {
        if (abortSignal === undefined) return;
        const rejectWithReason = () => reject(toError(abortSignal.reason));
        if (abortSignal.aborted) rejectWithReason();
        abortSignal.addEventListener("abort", rejectWithReason, { once: true });
      });
  }
}

function toResult(text: string, modelId: string, usage: FakeUsage, finishReason: "stop" | "length" = "stop") {
  const cached = usage.cachedInputTokens ?? 0;
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: finishReason, raw: finishReason },
    usage: {
      inputTokens: { total: usage.inputTokens, noCache: usage.inputTokens - cached, cacheRead: cached, cacheWrite: 0 },
      outputTokens: { total: usage.outputTokens, text: usage.outputTokens, reasoning: 0 },
    },
    response: { modelId },
    warnings: [],
  };
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("fakeModel: the call was aborted");
}
