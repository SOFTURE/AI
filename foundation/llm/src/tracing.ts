import { SpanStatusCode, trace, type Span, type Tracer } from "@opentelemetry/api";
import type { LlmErrorCode, LlmUsage } from "./contract.js";

export const TRACER_NAME = "@softure-ai/llm";
export const SPAN_NAME = "llm.generate_structured";

/** The global tracer: a no-op until the app starts an OpenTelemetry SDK (e.g. @softure-ai/observability). */
export function getDefaultTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

export function startCallSpan(tracer: Tracer, request: { provider: string; model: string }): Span {
  return tracer.startSpan(SPAN_NAME, {
    attributes: {
      "gen_ai.operation.name": "generate_content",
      "gen_ai.provider.name": request.provider,
      "gen_ai.request.model": request.model,
    },
  });
}

/** Ends the span with the outcome. Never records the prompt, the output or the call's attributes. */
export function endCallSpan(
  span: Span,
  outcome: { code: "ok" | LlmErrorCode; model?: string; usage?: LlmUsage; costUsd?: number | null },
): void {
  span.setAttribute("softure.llm.outcome", outcome.code);
  if (outcome.model !== undefined) span.setAttribute("gen_ai.response.model", outcome.model);
  if (outcome.usage !== undefined) {
    span.setAttribute("gen_ai.usage.input_tokens", outcome.usage.inputTokens);
    span.setAttribute("gen_ai.usage.output_tokens", outcome.usage.outputTokens);
  }
  if (outcome.costUsd !== undefined && outcome.costUsd !== null) span.setAttribute("softure.llm.cost_usd", outcome.costUsd);
  span.setStatus(outcome.code === "ok" ? { code: SpanStatusCode.OK } : { code: SpanStatusCode.ERROR, message: outcome.code });
  span.end();
}

/** Ends the span of a call that threw an error the package does not map to a code (a bug). */
export function failCallSpan(span: Span, error: unknown): void {
  if (error instanceof Error) span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: "unexpected error" });
  span.end();
}
