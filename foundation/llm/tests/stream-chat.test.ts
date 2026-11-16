import { SpanStatusCode } from "@opentelemetry/api";
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { createTestClock } from "@softure-ai/core";
import { isStepCount, tool } from "ai";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlm, type LlmCallRecord, type LlmOptions, type UsageRecord } from "../src/index.js";
import { fakeChatModel } from "../src/testing/index.js";

const START = new Date("2026-11-16T12:00:00Z");
const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0, reasoningTokens: 0 };
const PRICING = { small: { inputPerMillion: 1, outputPerMillion: 4 } };

const exporter = new InMemorySpanExporter();
const tracerProvider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
const tracer = tracerProvider.getTracer("test");

afterEach(() => {
  exporter.reset();
});

afterAll(async () => {
  await tracerProvider.shutdown();
});

/** A client whose hooks collect every record. */
function createRecordingLlm(options: Omit<LlmOptions, "onUsage" | "onCall" | "clock" | "tracer">) {
  const usages: UsageRecord[] = [];
  const calls: LlmCallRecord[] = [];
  const llm = createLlm({
    ...options,
    clock: createTestClock(START),
    tracer,
    onUsage: (record) => void usages.push(record),
    onCall: (record) => void calls.push(record),
  });
  return { llm, usages, calls };
}

const projectStatus = tool({
  description: "The state of a project",
  inputSchema: z.object({ projectId: z.string() }),
  execute: ({ projectId }) => ({ projectId, done: 64 }),
});

describe("streamChat", () => {
  it("streams the answer and records its usage, cost, answered model and attributes once it ends", async () => {
    const { llm, usages, calls } = createRecordingLlm({
      model: fakeChatModel({ modelId: "small" }, { kind: "text", text: "Apollo is on track." }),
      pricing: PRICING,
    });

    const stream = llm.streamChat({ prompt: "How is Apollo?", attributes: { accountId: "a1" } });

    expect(await stream.text).toBe("Apollo is on track.");
    await stream.recorded;
    expect(usages).toEqual([
      {
        model: "small",
        provider: "mock-provider",
        usage: USAGE,
        costUsd: 0.00003,
        costSource: "price_table",
        outcome: "ok",
        durationMs: 0,
        at: START,
        attributes: { accountId: "a1" },
      },
    ]);
    expect(calls).toEqual([
      {
        operation: "streamChat",
        model: "small",
        provider: "mock-provider",
        outcome: "ok",
        usage: USAGE,
        costUsd: 0.00003,
        costSource: "price_table",
        startedAt: START,
        durationMs: 0,
        attributes: { accountId: "a1" },
      },
    ]);
  });

  it("returns AI SDK's result, so a route answers with a UI message stream", async () => {
    const { llm } = createRecordingLlm({ model: fakeChatModel({ kind: "text", text: "Hello there" }) });

    const response = llm.streamChat({ messages: [{ role: "user", content: "Hi" }] }).toUIMessageStreamResponse();

    const body = await response.text();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(body).toContain('"delta":"Hello "');
    expect(body).toContain('"type":"finish"');
  });

  it("records a multi-step tool answer once, with the total usage and the provider's cost summed over the steps", async () => {
    const model = fakeChatModel(
      { modelId: "small" },
      {
        kind: "tool-call",
        toolName: "projectStatus",
        input: { projectId: "apollo" },
        usage: { inputTokens: 420, outputTokens: 38 },
        providerMetadata: { openrouter: { usage: { cost: 0.002 } } },
      },
      {
        kind: "text",
        text: "Apollo is 64% done.",
        usage: { inputTokens: 560, outputTokens: 54 },
        providerMetadata: { openrouter: { usage: { cost: 0.003 } } },
      },
    );
    const { llm, usages, calls } = createRecordingLlm({ model, pricing: PRICING });

    const stream = llm.streamChat({ prompt: "How is Apollo?", tools: { projectStatus }, stopWhen: isStepCount(3) });

    expect(await stream.text).toBe("Apollo is 64% done.");
    await stream.recorded;
    expect(model.doStreamCalls).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(usages).toHaveLength(1);
    expect(calls[0]?.usage).toEqual({ inputTokens: 980, outputTokens: 92, totalTokens: 1072, cachedInputTokens: 0, reasoningTokens: 0 });
    expect(calls[0]?.costUsd).toBeCloseTo(0.005, 10);
    expect(calls[0]?.costSource).toBe("provider");
  });

  it("records llm.output_truncated with the usage when the model stops on the token limit", async () => {
    const { llm, usages, calls } = createRecordingLlm({ model: fakeChatModel({ kind: "truncated", text: "Half an" }) });

    const stream = llm.streamChat({ prompt: "Write a lot", maxOutputTokens: 5 });

    expect(await stream.text).toBe("Half an");
    await stream.recorded;
    expect(usages.map((record) => record.outcome)).toEqual(["llm.output_truncated"]);
    expect(calls.map((record) => [record.outcome, record.usage])).toEqual([["llm.output_truncated", USAGE]]);
  });

  it("records llm.unavailable without usage when the provider fails before streaming", async () => {
    const { llm, usages, calls } = createRecordingLlm({ model: fakeChatModel({ modelId: "small" }, { kind: "unavailable" }), maxRetries: 0 });

    const stream = llm.streamChat({ prompt: "Hi" });

    await expect(stream.text).rejects.toThrow();
    await stream.recorded;
    expect(usages).toEqual([]);
    expect(calls).toEqual([expect.objectContaining({ outcome: "llm.unavailable", model: "small", usage: null, costUsd: null, costSource: null })]);
  });

  it("records llm.unavailable once when the provider fails mid-stream", async () => {
    const { llm, usages, calls } = createRecordingLlm({ model: fakeChatModel({ kind: "error", text: "Partial" }) });

    const stream = llm.streamChat({ prompt: "Hi" });

    await stream.consumeStream();
    await stream.recorded;
    expect(usages).toEqual([]);
    expect(calls.map((record) => [record.outcome, record.usage])).toEqual([["llm.unavailable", null]]);
  });

  it("records llm.timeout when the answer does not end within timeoutMs", async () => {
    const { llm, calls } = createRecordingLlm({ model: fakeChatModel({ kind: "hang", text: "Thinking" }), timeoutMs: 60_000 });

    const stream = llm.streamChat({ prompt: "Hi", timeoutMs: 20 });

    await stream.consumeStream();
    await stream.recorded;
    expect(calls.map((record) => [record.outcome, record.usage])).toEqual([["llm.timeout", null]]);
  });

  it("records llm.aborted with the usage of the finished steps when the user stops the answer", async () => {
    const model = fakeChatModel(
      { kind: "tool-call", toolName: "projectStatus", input: { projectId: "apollo" }, usage: { inputTokens: 420, outputTokens: 38 } },
      { kind: "hang", text: "Apollo is" },
    );
    const { llm, usages, calls } = createRecordingLlm({ model, pricing: { "fake-model": { inputPerMillion: 1, outputPerMillion: 1 } } });
    const controller = new AbortController();
    const stream = llm.streamChat({ prompt: "Hi", tools: { projectStatus }, stopWhen: isStepCount(3), abortSignal: controller.signal });

    for await (const part of stream.fullStream) {
      if (part.type === "text-delta") controller.abort();
    }
    await stream.recorded;

    const stepUsage = { inputTokens: 420, outputTokens: 38, totalTokens: 458, cachedInputTokens: 0, reasoningTokens: 0 };
    expect(usages.map((record) => [record.outcome, record.usage, record.costUsd])).toEqual([["llm.aborted", stepUsage, 0.000458]]);
    expect(calls.map((record) => [record.outcome, record.usage])).toEqual([["llm.aborted", stepUsage]]);
  });

  it("records llm.aborted without usage when the user stops before any model call finished", async () => {
    const { llm, usages, calls } = createRecordingLlm({ model: fakeChatModel({ kind: "hang", text: "Apollo" }) });
    const controller = new AbortController();
    const stream = llm.streamChat({ prompt: "Hi", abortSignal: controller.signal });

    for await (const part of stream.fullStream) {
      if (part.type === "text-delta") controller.abort();
    }
    await stream.recorded;

    expect(usages).toEqual([]);
    expect(calls.map((record) => [record.outcome, record.usage, record.costUsd])).toEqual([["llm.aborted", null, null]]);
  });

  it("still calls the request's own onEnd, onStepEnd, onAbort and onError", async () => {
    const seen: string[] = [];
    const { llm } = createRecordingLlm({ model: fakeChatModel({ kind: "text", text: "Done" }, { kind: "error" }, { kind: "hang" }) });

    const answered = llm.streamChat({ prompt: "1", onEnd: () => void seen.push("end"), onStepEnd: () => void seen.push("step") });
    await answered.consumeStream();
    await answered.recorded;
    const failing = llm.streamChat({ prompt: "2", onError: () => void seen.push("error") });
    await failing.consumeStream();
    await failing.recorded;
    const controller = new AbortController();
    const aborted = llm.streamChat({ prompt: "3", abortSignal: controller.signal, onAbort: () => void seen.push("abort") });
    controller.abort();
    await aborted.consumeStream();
    await aborted.recorded;

    expect(seen).toEqual(["step", "end", "error", "abort"]);
  });

  it("rejects recorded with the error a hook threw, and records it on the span", async () => {
    const failure = new Error("ledger down");
    const llm = createLlm({
      model: fakeChatModel({ kind: "text", text: "Hi" }),
      tracer,
      onUsage: () => {
        throw failure;
      },
    });

    const stream = llm.streamChat({ prompt: "Hi" });

    expect(await stream.text).toBe("Hi");
    await expect(stream.recorded).rejects.toBe(failure);
    const [span] = exporter.getFinishedSpans();
    expect(span?.events.map((event) => event.name)).toEqual(["exception"]);
  });

  it("writes one llm.stream_chat span with the model, tokens, cost and outcome, never the prompt or attributes", async () => {
    const { llm } = createRecordingLlm({ model: fakeChatModel({ modelId: "small", provider: "openrouter" }, { kind: "text", text: "Hi" }), pricing: PRICING });

    const stream = llm.streamChat({ prompt: "private prompt", attributes: { accountId: "acc-1" } });
    await stream.consumeStream();
    await stream.recorded;

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name)).toEqual(["llm.stream_chat"]);
    expect(spans[0]?.attributes).toEqual({
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openrouter",
      "gen_ai.request.model": "small",
      "gen_ai.response.model": "small",
      "gen_ai.usage.input_tokens": 10,
      "gen_ai.usage.output_tokens": 5,
      "softure.llm.cost_source": "price_table",
      "softure.llm.cost_usd": 0.00003,
      "softure.llm.outcome": "ok",
    });
    expect(spans[0]?.status).toEqual({ code: SpanStatusCode.OK });
  });

  it("marks the span as an error with the code of a failed chat", async () => {
    const { llm } = createRecordingLlm({ model: fakeChatModel({ kind: "unavailable" }), maxRetries: 0 });

    const stream = llm.streamChat({ prompt: "Hi" });
    await stream.consumeStream();
    await stream.recorded;

    expect(exporter.getFinishedSpans()[0]?.status).toEqual({ code: SpanStatusCode.ERROR, message: "llm.unavailable" });
  });

  it("uses the request's model over the client's", async () => {
    const fallback = fakeChatModel({ modelId: "default" }, { kind: "text", text: "A" });
    const chosen = fakeChatModel({ modelId: "chosen" }, { kind: "text", text: "B" });
    const { llm, calls } = createRecordingLlm({ model: fallback });

    expect(await llm.streamChat({ prompt: "Hi", model: chosen }).text).toBe("B");

    expect(fallback.doStreamCalls).toHaveLength(0);
    expect(calls.map((record) => record.model)).toEqual(["chosen"]);
  });

  it.each([
    [{ timeoutMs: 0 }, "createLlm: streamChat: timeoutMs must be a positive number of milliseconds"],
    [{ maxOutputTokens: 1.5 }, "createLlm: streamChat: maxOutputTokens must be a whole number of 1 or more"],
  ])("throws a RangeError for %o before the model is called", (field, message) => {
    const model = fakeChatModel({ kind: "text", text: "Hi" });
    const llm = createLlm({ model });

    expect(() => llm.streamChat({ prompt: "Hi", ...field })).toThrow(new RangeError(message));
    expect(model.doStreamCalls).toHaveLength(0);
  });
});
