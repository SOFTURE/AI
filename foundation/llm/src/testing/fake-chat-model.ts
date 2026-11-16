// Streaming test double for code that calls `streamChat`: an AI SDK model that streams answers from a script.
import { APICallError, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { FakeModelOptions, FakeProviderMetadata, FakeUsage } from "./index.js";

const DEFAULT_MODEL_ID = "fake-model";
const DEFAULT_USAGE: FakeUsage = { inputTokens: 10, outputTokens: 5 };

type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;
type StreamCallOptions = Parameters<MockLanguageModelV4["doStream"]>[0];

/** What a streamed answer may carry besides its text. */
interface FakeStreamDetails {
  readonly usage?: FakeUsage;
  readonly providerMetadata?: FakeProviderMetadata;
}

/** One scripted streamed answer (one model call, one step of a chat). `usage` defaults to 10 input and 5 output tokens. */
export type FakeChatResponse =
  /** Streams `text` word by word and stops. */
  | ({ readonly kind: "text"; readonly text: string } & FakeStreamDetails)
  /** Streams `text` (default none), then calls the tool `toolName` with `input`; the chat's next step takes the next response. */
  | ({ readonly kind: "tool-call"; readonly toolName: string; readonly input: unknown; readonly text?: string } & FakeStreamDetails)
  /** Streams `text` (default none) and stops on the output token limit (`llm.output_truncated`). */
  | ({ readonly kind: "truncated"; readonly text?: string } & FakeStreamDetails)
  /** Fails like a provider returning HTTP 503 before anything streams (`llm.unavailable`). */
  | { readonly kind: "unavailable" }
  /** Streams `text` (default none), then sends a provider error (`llm.unavailable`). */
  | { readonly kind: "error"; readonly text?: string }
  /** Streams `text` (default none), then never finishes; ends only when the call is aborted (`llm.aborted`, `llm.timeout`). */
  | { readonly kind: "hang"; readonly text?: string };

export interface FakeChatModelOptions extends FakeModelOptions {
  /** Delay between two streamed parts in milliseconds. Default 0. */
  readonly chunkDelayInMs?: number;
}

/** An AI SDK model; `doStreamCalls` lists what each call sent (prompt, tools, abort signal). */
export type FakeChatModel = MockLanguageModelV4;

/**
 * A model that streams call N with `responses[N]`; the last response repeats. Pass it to `createLlm({ model })` and
 * call `streamChat`. `fakeChatModel({ kind: "text", text: "Hello there" })`.
 */
export function fakeChatModel(...responses: [FakeChatResponse, ...FakeChatResponse[]]): FakeChatModel;
export function fakeChatModel(options: FakeChatModelOptions, ...responses: [FakeChatResponse, ...FakeChatResponse[]]): FakeChatModel;
export function fakeChatModel(...args: [FakeChatModelOptions | FakeChatResponse, ...FakeChatResponse[]]): FakeChatModel {
  const [first, ...rest] = args;
  const options: FakeChatModelOptions = isResponse(first) ? {} : first;
  const responses: FakeChatResponse[] = isResponse(first) ? [first, ...rest] : rest;
  if (responses.length === 0) throw new RangeError("fakeChatModel: pass at least one response");
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const chunkDelayInMs = options.chunkDelayInMs ?? 0;
  let callCount = 0;

  return new MockLanguageModelV4({
    modelId,
    ...(options.provider === undefined ? {} : { provider: options.provider }),
    doStream: (call: StreamCallOptions) => {
      const index = Math.min(callCount, responses.length - 1);
      callCount += 1;
      // `responses` is non-empty and the index is clamped to it.
      const response = responses[index]!;
      if (response.kind === "unavailable") return Promise.reject(unavailableError());
      const parts = toParts(response, modelId, callCount);
      if (response.kind === "hang") return Promise.resolve({ stream: hangingStream(parts, call.abortSignal) });
      return Promise.resolve({ stream: simulateReadableStream<StreamPart>({ chunks: parts, chunkDelayInMs }) });
    },
  });
}

function isResponse(value: FakeChatModelOptions | FakeChatResponse): value is FakeChatResponse {
  return "kind" in value;
}

function toParts(response: Exclude<FakeChatResponse, { kind: "unavailable" }>, modelId: string, callNumber: number): StreamPart[] {
  const textId = `text-${String(callNumber)}`;
  const text = response.text ?? "";
  const head: StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "response-metadata", id: `response-${String(callNumber)}`, modelId, timestamp: new Date(0) },
  ];
  const textParts: StreamPart[] =
    text === ""
      ? []
      : [
          { type: "text-start", id: textId },
          ...text.split(/(?<= )/).map((delta): StreamPart => ({ type: "text-delta", id: textId, delta })),
          { type: "text-end", id: textId },
        ];
  switch (response.kind) {
    case "text":
      return [...head, ...textParts, finish("stop", response)];
    case "truncated":
      return [...head, ...textParts, finish("length", response)];
    case "tool-call":
      return [
        ...head,
        ...textParts,
        { type: "tool-call", toolCallId: `call-${String(callNumber)}`, toolName: response.toolName, input: JSON.stringify(response.input) },
        finish("tool-calls", response),
      ];
    case "error":
      return [...head, ...textParts, { type: "error", error: unavailableError() }];
    case "hang":
      return [...head, ...textParts];
  }
}

function finish(reason: "stop" | "length" | "tool-calls", details: FakeStreamDetails): StreamPart {
  const usage = details.usage ?? DEFAULT_USAGE;
  const cached = usage.cachedInputTokens ?? 0;
  return {
    type: "finish",
    finishReason: { unified: reason, raw: reason },
    usage: {
      inputTokens: { total: usage.inputTokens, noCache: usage.inputTokens - cached, cacheRead: cached, cacheWrite: 0 },
      outputTokens: { total: usage.outputTokens, text: usage.outputTokens, reasoning: 0 },
    },
    ...(details.providerMetadata === undefined ? {} : { providerMetadata: details.providerMetadata }),
  };
}

/** Sends `parts`, then stays open until `abortSignal` aborts, and errors with its reason. */
function hangingStream(parts: StreamPart[], abortSignal: AbortSignal | undefined): ReadableStream<StreamPart> {
  return new ReadableStream<StreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      if (abortSignal === undefined) return;
      const fail = () => {
        controller.error(abortSignal.reason instanceof Error ? abortSignal.reason : new Error("fakeChatModel: the call was aborted"));
      };
      if (abortSignal.aborted) fail();
      else abortSignal.addEventListener("abort", fail, { once: true });
    },
  });
}

function unavailableError(): APICallError {
  return new APICallError({
    message: "fakeChatModel: the provider is unavailable",
    url: "https://fake-model.invalid/v1",
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: false,
  });
}
