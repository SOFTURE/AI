// streamChat: AI SDK's streamText under the client's model, time limit, hooks, pricing and spans.
import type { Tracer } from "@opentelemetry/api";
import type { Clock } from "@softure-ai/core";
import { streamText, type LanguageModelUsage, type ProviderMetadata, type ToolSet } from "ai";
import type { CostSource, LlmCallHook, LlmOutcome, LlmUsage, ModelPricing, UsageRecord } from "./contract.js";
import type { LlmModel } from "./create-llm.js";
import { endCallSpan, startCallSpan, STREAM_CHAT_SPAN_NAME } from "./tracing.js";
import { readProviderCostUsd, resolveCost, toLlmUsage } from "./usage.js";

type SdkStreamOptions<TOOLS extends ToolSet> = Parameters<typeof streamText<TOOLS>>[0];
type SdkStreamResult<TOOLS extends ToolSet> = ReturnType<typeof streamText<TOOLS>>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * The options of AI SDK `streamText` (`messages` or `prompt`, `instructions`, `tools`, `stopWhen`, `maxOutputTokens`,
 * `abortSignal`, `onEnd`, ...) without `model`, `timeout` and `streamRetries`, plus the client's own fields.
 */
export type ChatRequest<TOOLS extends ToolSet = ToolSet> = DistributiveOmit<SdkStreamOptions<TOOLS>, "model" | "timeout" | "streamRetries"> & {
  /** Overrides the client's model for this chat. */
  readonly model?: LlmModel;
  /** Time limit of the whole chat answer, every step and retry included. Default: the client's `timeoutMs`, else 30 000. */
  readonly timeoutMs?: number;
  /** Passed to `onUsage` and `onCall` as given (e.g. `{ accountId }`); never written to spans. */
  readonly attributes?: Readonly<Record<string, string>>;
};

/**
 * AI SDK's `StreamTextResult` (call `toUIMessageStreamResponse()` on it), plus `recorded`: it resolves once `onUsage`
 * and `onCall` ran for this chat and rejects with the error either of them threw. Hand it to the platform's
 * after-response hook (Next.js `after(() => stream.recorded)`), since the response has left by then.
 */
export type ChatStream<TOOLS extends ToolSet = ToolSet> = SdkStreamResult<TOOLS> & { readonly recorded: Promise<void> };

/** What `createLlm` hands to a chat. */
export interface StreamChatContext {
  readonly model: LlmModel;
  readonly timeoutMs: number;
  readonly pricing: ModelPricing;
  readonly onUsage: ((record: UsageRecord) => void | Promise<void>) | undefined;
  readonly onCall: LlmCallHook | undefined;
  readonly clock: Clock;
  readonly tracer: Tracer;
}

/** The parts of a finished model call (a step) the records read. */
interface StepLike {
  readonly finishReason: string;
  readonly usage: LanguageModelUsage;
  readonly providerMetadata: ProviderMetadata | undefined;
  readonly response: { readonly modelId: string };
}

interface ChatEnd {
  readonly outcome: LlmOutcome;
  readonly model: string;
  /** `null` when no model call of the chat finished with reported usage. */
  readonly usage: LlmUsage | null;
  readonly providerCostUsd: number | null;
}

const TIMEOUT_ERROR_NAME = "TimeoutError";

/** Starts the stream. The caller validated `timeoutMs` and `maxOutputTokens`. */
export function startStreamChat<TOOLS extends ToolSet>(context: StreamChatContext, request: ChatRequest<TOOLS>): ChatStream<TOOLS> {
  const { model: requestModel, timeoutMs, attributes = {}, onEnd, onFinish, onAbort, onError, onStepEnd, onStepFinish, ...rest } = request;
  const model = requestModel ?? context.model;
  const { provider, modelId } = model;
  const span = startCallSpan(context.tracer, STREAM_CHAT_SPAN_NAME, { provider, model: modelId, operation: "chat" });
  const startedAt = context.clock.now();
  const finishedSteps: StepLike[] = [];
  let isSettled = false;

  let resolveRecorded: () => void = () => undefined;
  let rejectRecorded: (error: unknown) => void = () => undefined;
  const recorded = new Promise<void>((resolve, reject) => {
    resolveRecorded = resolve;
    rejectRecorded = reject;
  });
  // Marked handled so an app that never awaits it gets no unhandled rejection; awaiting it still rejects.
  recorded.catch(() => undefined);

  const settle = async (end: ChatEnd): Promise<void> => {
    if (isSettled) return;
    isSettled = true;
    const durationMs = context.clock.now().getTime() - startedAt.getTime();
    const { costUsd, costSource } = resolveCost({
      pricing: context.pricing,
      model: end.model,
      usage: end.usage ?? undefined,
      providerCostUsd: end.providerCostUsd,
    });
    try {
      await report(context, { end, provider, costUsd, costSource, startedAt, durationMs, attributes });
    } catch (error) {
      if (error instanceof Error) span.recordException(error);
      endCallSpan(span, toSpanOutcome(end, costUsd, costSource));
      rejectRecorded(error);
      return;
    }
    endCallSpan(span, toSpanOutcome(end, costUsd, costSource));
    resolveRecorded();
  };

  const settleFromSteps = (outcome: LlmOutcome, steps: readonly StepLike[]): Promise<void> => {
    const answered = steps.filter((step) => step.finishReason !== "error");
    return settle({
      outcome,
      model: answered.at(-1)?.response.modelId ?? modelId,
      usage: sumUsage(answered.map((step) => step.usage)),
      providerCostUsd: sumProviderCost(answered),
    });
  };

  const callerOnEnd = onEnd ?? onFinish;
  const callerOnStepEnd = onStepEnd ?? onStepFinish;

  // The SDK's callback types are generic over the tool set; the wrapper reads only the fields of `StepLike`.
  const options = {
    ...rest,
    model,
    timeout: timeoutMs ?? context.timeoutMs,
    onStepEnd: async (step: Parameters<NonNullable<typeof callerOnStepEnd>>[0]) => {
      finishedSteps.push(step);
      await callerOnStepEnd?.(step);
    },
    onEnd: async (event: Parameters<NonNullable<typeof callerOnEnd>>[0]) => {
      if (event.finishReason === "error") await settleFromSteps("llm.unavailable", event.steps);
      else
        await settle({
          outcome: event.finishReason === "length" ? "llm.output_truncated" : "ok",
          model: event.response.modelId,
          usage: toLlmUsage(event.totalUsage),
          providerCostUsd: sumProviderCost(event.steps),
        });
      await callerOnEnd?.(event);
    },
    onAbort: async (event: Parameters<NonNullable<typeof onAbort>>[0]) => {
      await settleFromSteps(isTimeout(event.reason) ? "llm.timeout" : "llm.aborted", event.steps);
      await onAbort?.(event);
    },
    onError: async (event: { error: unknown }) => {
      if (event.error instanceof Error) span.recordException(event.error);
      await settleFromSteps("llm.unavailable", finishedSteps);
      await onError?.(event);
    },
  } as SdkStreamOptions<TOOLS>;

  const result = streamText<TOOLS>(options);
  Object.defineProperty(result, "recorded", { value: recorded, enumerable: false });
  // `recorded` was defined on the result just above.
  return result as ChatStream<TOOLS>;
}

async function report(
  context: StreamChatContext,
  input: {
    readonly end: ChatEnd;
    readonly provider: string;
    readonly costUsd: number | null;
    readonly costSource: CostSource | null;
    readonly startedAt: Date;
    readonly durationMs: number;
    readonly attributes: Readonly<Record<string, string>>;
  },
): Promise<void> {
  const { end, provider, costUsd, costSource, startedAt, durationMs, attributes } = input;
  if (end.usage !== null && context.onUsage !== undefined) {
    await context.onUsage({ model: end.model, provider, usage: end.usage, costUsd, costSource, outcome: end.outcome, durationMs, at: startedAt, attributes });
  }
  if (context.onCall !== undefined) {
    await context.onCall({
      operation: "streamChat",
      model: end.model,
      provider,
      outcome: end.outcome,
      usage: end.usage,
      costUsd,
      costSource,
      startedAt,
      durationMs,
      attributes,
    });
  }
}

function toSpanOutcome(end: ChatEnd, costUsd: number | null, costSource: CostSource | null) {
  return { code: end.outcome, model: end.model, ...(end.usage === null ? {} : { usage: end.usage }), costUsd, costSource };
}

function isTimeout(reason: unknown): boolean {
  return typeof reason === "object" && reason !== null && "name" in reason && reason.name === TIMEOUT_ERROR_NAME;
}

/** The usage of several model calls added up, or `null` for none. */
function sumUsage(usages: readonly LanguageModelUsage[]): LlmUsage | null {
  if (usages.length === 0) return null;
  return usages.map(toLlmUsage).reduce((total, usage) => ({
    inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
    totalTokens: total.totalTokens + usage.totalTokens,
    cachedInputTokens: total.cachedInputTokens + usage.cachedInputTokens,
    reasoningTokens: total.reasoningTokens + usage.reasoningTokens,
  }));
}

/** The provider's billed USD over the steps that reported one, or `null` when none did. */
function sumProviderCost(steps: readonly Pick<StepLike, "providerMetadata">[]): number | null {
  const costs = steps.map((step) => readProviderCostUsd(step.providerMetadata)).filter((cost): cost is number => cost !== null);
  if (costs.length === 0) return null;
  return costs.reduce((total, cost) => total + cost, 0);
}
