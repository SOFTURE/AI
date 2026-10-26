// Issue #805: the cost the provider billed reaches the result and onUsage with its source, and onCall gets one record
// for every finished call, failures and timeouts included.
import { createTestClock } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLlm, type LlmCallRecord, type UsageRecord } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const START = new Date("2026-10-26T12:00:00Z");
const scoreSchema = z.object({ score: z.number() });
const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0, reasoningTokens: 0 };
const billed = (cost: unknown) => ({ openrouter: { usage: { cost } } }) as never;

function captureCalls(): { records: LlmCallRecord[]; onCall: (record: LlmCallRecord) => void } {
  const records: LlmCallRecord[] = [];
  return { records, onCall: (record) => void records.push(record) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the provider's billed cost", () => {
  it("prefers the provider's cost over the price table, in the result and in onUsage", async () => {
    const usage: UsageRecord[] = [];
    const llm = createLlm({
      model: fakeModel({ modelId: "small" }, { kind: "output", value: { score: 3 }, providerMetadata: billed(0.0042) }),
      pricing: { small: { inputPerMillion: 1, outputPerMillion: 4 } },
      onUsage: (record) => void usage.push(record),
    });

    const result = await llm.generateStructured({ schema: scoreSchema, prompt: "Text" });

    expect(result.ok && [result.value.costUsd, result.value.costSource]).toEqual([0.0042, "provider"]);
    expect(usage.map((record) => [record.costUsd, record.costSource])).toEqual([[0.0042, "provider"]]);
  });

  it("gives the provider's cost for a model the price table does not list", async () => {
    const llm = createLlm({ model: fakeModel({ kind: "text", text: "A title", providerMetadata: billed(0) }) });

    const result = await llm.generateText({ prompt: "Text" });

    expect(result.ok && [result.value.costUsd, result.value.costSource]).toEqual([0, "provider"]);
  });

  it("falls back to the price table when the provider reports no usable cost", async () => {
    const pricing = { small: { inputPerMillion: 1, outputPerMillion: 4 } };
    const costs: unknown[] = [];
    for (const providerMetadata of [undefined, billed("0.1"), billed(-1), billed(Number.NaN), { other: { cost: 1 } }]) {
      const model = fakeModel({ modelId: "small" }, { kind: "output", value: { score: 1 }, ...(providerMetadata === undefined ? {} : { providerMetadata }) });
      const result = await createLlm({ model, pricing }).generateStructured({ schema: scoreSchema, prompt: "Text" });
      costs.push(result.ok && [result.value.costUsd, result.value.costSource]);
    }

    expect(costs).toEqual(Array.from({ length: 5 }, () => [0.00003, "price_table"]));
  });

  it("has no cost and no source without a provider figure or a price", async () => {
    const result = await createLlm({ model: fakeModel({ kind: "output", value: { score: 1 } }) }).generateStructured({
      schema: scoreSchema,
      prompt: "Text",
    });

    expect(result.ok && [result.value.costUsd, result.value.costSource]).toEqual([null, null]);
  });

  it("records the provider's cost of a truncated answer", async () => {
    const usage: UsageRecord[] = [];
    const llm = createLlm({
      model: fakeModel({ kind: "truncated", text: "Half", providerMetadata: billed(0.001) }),
      onUsage: (record) => void usage.push(record),
    });

    expect(await llm.generateText({ prompt: "Text" })).toEqual({ ok: false, error: "llm.output_truncated" });
    expect(usage.map((record) => [record.outcome, record.costUsd, record.costSource])).toEqual([["llm.output_truncated", 0.001, "provider"]]);
  });
});

describe("onCall", () => {
  it("records a successful call with operation, model, usage, cost, start, duration and attributes", async () => {
    const calls = captureCalls();
    const clock = createTestClock(START);
    const model = fakeModel({ modelId: "small", provider: "openrouter" }, { kind: "output", value: { score: 3 }, providerMetadata: billed(0.002) });
    const advance = model.doGenerate.bind(model);
    model.doGenerate = async (options) => {
      clock.advance(1_250);
      return advance(options);
    };
    const llm = createLlm({ model, clock, onCall: calls.onCall });

    await llm.generateStructured({ schema: scoreSchema, prompt: "Text", attributes: { flow: "scoring" } });

    expect(calls.records).toEqual([
      {
        operation: "generateStructured",
        model: "small",
        provider: "openrouter",
        outcome: "ok",
        usage: USAGE,
        costUsd: 0.002,
        costSource: "provider",
        startedAt: START,
        durationMs: 1_250,
        attributes: { flow: "scoring" },
      },
    ]);
  });

  it("records llm.unavailable without usage, under the requested model", async () => {
    const calls = captureCalls();
    const usage: UsageRecord[] = [];
    const llm = createLlm({
      model: fakeModel({ modelId: "requested" }, { kind: "unavailable" }),
      maxRetries: 0,
      onUsage: (record) => void usage.push(record),
      onCall: calls.onCall,
    });

    expect(await llm.generateText({ prompt: "Text" })).toEqual({ ok: false, error: "llm.unavailable" });
    expect(usage).toEqual([]);
    expect(calls.records.map((record) => [record.operation, record.model, record.outcome, record.usage, record.costUsd, record.costSource])).toEqual([
      ["generateText", "requested", "llm.unavailable", null, null, null],
    ]);
  });

  it("records llm.timeout with the time the call took", async () => {
    vi.useFakeTimers({ now: START });
    const calls = captureCalls();
    const llm = createLlm({ model: fakeModel({ modelId: "slow" }, { kind: "hang" }), timeoutMs: 1_000, onCall: calls.onCall });

    const pending = llm.generateStructured({ schema: scoreSchema, prompt: "Text", attributes: { flow: "scoring" } });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ ok: false, error: "llm.timeout" });
    expect(calls.records).toEqual([
      {
        operation: "generateStructured",
        model: "slow",
        provider: "mock-provider",
        outcome: "llm.timeout",
        usage: null,
        costUsd: null,
        costSource: null,
        startedAt: START,
        durationMs: 1_000,
        attributes: { flow: "scoring" },
      },
    ]);
  });

  it("records llm.invalid_output with its usage, after onUsage", async () => {
    const order: string[] = [];
    const llm = createLlm({
      model: fakeModel({ kind: "text", text: "not json" }),
      onUsage: () => void order.push("usage"),
      onCall: (record) => void order.push(`call ${record.outcome} ${String(record.usage?.totalTokens)}`),
    });

    expect(await llm.generateStructured({ schema: scoreSchema, prompt: "Text" })).toEqual({ ok: false, error: "llm.invalid_output" });
    expect(order).toEqual(["usage", "call llm.invalid_output 15"]);
  });

  it("lets a failing onCall hook propagate, also for a timeout", async () => {
    vi.useFakeTimers();
    const onCall = () => Promise.reject(new Error("ledger down"));
    const answered = createLlm({ model: fakeModel({ kind: "output", value: { score: 1 } }), onCall });
    await expect(answered.generateStructured({ schema: scoreSchema, prompt: "Text" })).rejects.toThrow("ledger down");

    const hanging = createLlm({ model: fakeModel({ kind: "hang" }), timeoutMs: 100, onCall });
    const pending = expect(hanging.generateText({ prompt: "Text" })).rejects.toThrow("ledger down");
    await vi.advanceTimersByTimeAsync(100);
    await pending;
  });
});
