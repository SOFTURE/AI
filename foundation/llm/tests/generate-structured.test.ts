import { createTestClock } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLlm, type UsageRecord } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const scoreSchema = z.object({ score: z.number() });
const START = new Date("2026-10-14T12:00:00Z");

function captureUsage(): { records: UsageRecord[]; onUsage: (record: UsageRecord) => void } {
  const records: UsageRecord[] = [];
  return { records, onUsage: (record) => void records.push(record) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("generateStructured", () => {
  it("returns the output validated by the schema, with usage, model and cost", async () => {
    const usage = captureUsage();
    const llm = createLlm({
      model: fakeModel({ modelId: "small" }, { kind: "output", value: { score: 3 } }),
      pricing: { small: { inputPerMillion: 1, outputPerMillion: 4 } },
      onUsage: usage.onUsage,
      clock: createTestClock(START),
    });

    const result = await llm.generateStructured({ schema: scoreSchema, system: "Score it.", prompt: "Text", attributes: { accountId: "a1" } });

    expect(result).toEqual({
      ok: true,
      value: {
        output: { score: 3 },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0, reasoningTokens: 0 },
        model: "small",
        costUsd: 0.00003,
        costSource: "price_table",
      },
    });
    expect(usage.records).toEqual([
      {
        model: "small",
        provider: "mock-provider",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0, reasoningTokens: 0 },
        costUsd: 0.00003,
        costSource: "price_table",
        outcome: "ok",
        durationMs: 0,
        at: START,
        attributes: { accountId: "a1" },
      },
    ]);
  });

  it("sends the system text, the prompt and a JSON response format to the model", async () => {
    const model = fakeModel({ kind: "output", value: { score: 1 } });
    const llm = createLlm({ model });

    await llm.generateStructured({ schema: scoreSchema, system: "Score it.", prompt: "Text" });

    const [call] = model.doGenerateCalls;
    expect(call?.responseFormat?.type).toBe("json");
    expect(JSON.stringify(call?.prompt)).toContain("Score it.");
    expect(JSON.stringify(call?.prompt)).toContain("Text");
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["JSON of the wrong shape", '{"score":"high"}'],
  ])("returns llm.invalid_output for %s and still records the spent tokens", async (_case, text) => {
    const usage = captureUsage();
    const llm = createLlm({ model: fakeModel({ kind: "text", text }), onUsage: usage.onUsage });

    const result = await llm.generateStructured({ schema: scoreSchema, prompt: "Text" });

    expect(result).toEqual({ ok: false, error: "llm.invalid_output" });
    expect(usage.records.map((record) => [record.outcome, record.usage.totalTokens])).toEqual([["llm.invalid_output", 15]]);
  });

  it("sends maxOutputTokens to the model", async () => {
    const model = fakeModel({ kind: "output", value: { score: 1 } });

    await createLlm({ model }).generateStructured({ schema: scoreSchema, prompt: "Text", maxOutputTokens: 64 });

    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(64);
  });

  it("returns llm.output_truncated when the model stops on the token limit, and records the usage", async () => {
    const usage = captureUsage();
    const llm = createLlm({ model: fakeModel({ kind: "truncated", text: '{"score":' }), onUsage: usage.onUsage });

    const result = await llm.generateStructured({ schema: scoreSchema, prompt: "Text" });

    expect(result).toEqual({ ok: false, error: "llm.output_truncated" });
    expect(usage.records.map((record) => [record.outcome, record.usage.totalTokens])).toEqual([["llm.output_truncated", 15]]);
  });

  it("returns llm.unavailable when the provider fails, and records no usage", async () => {
    const usage = captureUsage();
    const llm = createLlm({ model: fakeModel({ kind: "unavailable" }), onUsage: usage.onUsage, maxRetries: 0 });

    const result = await llm.generateStructured({ schema: scoreSchema, prompt: "Text" });

    expect(result).toEqual({ ok: false, error: "llm.unavailable" });
    expect(usage.records).toEqual([]);
  });

  it("returns llm.timeout when the model does not answer in time, and aborts the call", async () => {
    vi.useFakeTimers();
    const usage = captureUsage();
    const model = fakeModel({ kind: "hang" });
    const llm = createLlm({ model, timeoutMs: 1_000, onUsage: usage.onUsage });

    const pending = llm.generateStructured({ schema: scoreSchema, prompt: "Text" });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ ok: false, error: "llm.timeout" });
    expect(model.doGenerateCalls[0]?.abortSignal?.aborted).toBe(true);
    expect(usage.records).toEqual([]);
  });

  it("ends as llm.timeout when the model ignores the abort signal, without an unhandled rejection", async () => {
    vi.useFakeTimers();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    let rejectLate: (error: Error) => void = () => undefined;
    const model = fakeModel({ kind: "output", value: { score: 1 } });
    model.doGenerate = () => new Promise((_resolve, reject) => (rejectLate = reject));
    const llm = createLlm({ model, timeoutMs: 500 });

    const pending = llm.generateStructured({ schema: scoreSchema, prompt: "Text" });
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;
    rejectLate(new Error("late failure"));
    await vi.advanceTimersByTimeAsync(0);
    process.off("unhandledRejection", unhandled);

    expect(result).toEqual({ ok: false, error: "llm.timeout" });
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("clears its timer when the model answers", async () => {
    vi.useFakeTimers();
    const llm = createLlm({ model: fakeModel({ kind: "output", value: { score: 2 } }), timeoutMs: 60_000 });

    await llm.generateStructured({ schema: scoreSchema, prompt: "Text" });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("takes the model and the time limit of one call over the defaults", async () => {
    vi.useFakeTimers();
    const fallback = fakeModel({ modelId: "default" }, { kind: "output", value: { score: 1 } });
    const special = fakeModel({ modelId: "special" }, { kind: "hang" });
    const llm = createLlm({ model: fallback, timeoutMs: 60_000 });

    const pending = llm.generateStructured({ schema: scoreSchema, prompt: "Text", model: special, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(100);

    expect(await pending).toEqual({ ok: false, error: "llm.timeout" });
    expect(fallback.doGenerateCalls).toHaveLength(0);
    expect(special.doGenerateCalls).toHaveLength(1);
  });

  it("lets an error that is not the AI SDK's propagate", async () => {
    const model = fakeModel({ kind: "output", value: { score: 1 } });
    model.doGenerate = () => Promise.reject(new TypeError("bug in the provider"));
    const llm = createLlm({ model });

    await expect(llm.generateStructured({ schema: scoreSchema, prompt: "Text" })).rejects.toThrow("bug in the provider");
  });

  it("lets a failing onUsage hook propagate", async () => {
    const llm = createLlm({
      model: fakeModel({ kind: "output", value: { score: 1 } }),
      onUsage: () => Promise.reject(new Error("quota store down")),
    });

    await expect(llm.generateStructured({ schema: scoreSchema, prompt: "Text" })).rejects.toThrow("quota store down");
  });

});

describe("createLlm options", () => {
  const model = fakeModel({ kind: "output", value: {} });

  it.each([
    [{ timeoutMs: 0 }, "timeoutMs"],
    [{ timeoutMs: Number.NaN }, "timeoutMs"],
    [{ maxRetries: -1 }, "maxRetries"],
    [{ maxRetries: 1.5 }, "maxRetries"],
    [{ pricing: { m: { inputPerMillion: -1, outputPerMillion: 1 } } }, 'pricing["m"]'],
    [{ pricing: { m: { inputPerMillion: 1, outputPerMillion: 1, cachedInputPerMillion: Number.POSITIVE_INFINITY } } }, 'pricing["m"]'],
  ])("refuses %o naming %s", (options, name) => {
    const create = () => createLlm({ model, ...options });

    expect(create).toThrow(RangeError);
    expect(create).toThrow(name);
  });

  it("refuses a time limit of a call that is not positive", async () => {
    const llm = createLlm({ model });

    await expect(llm.generateStructured({ schema: scoreSchema, prompt: "Text", timeoutMs: -5 })).rejects.toThrow(RangeError);
  });

  it("refuses a token limit that is not a positive whole number", async () => {
    const llm = createLlm({ model });

    await expect(llm.generateStructured({ schema: scoreSchema, prompt: "Text", maxOutputTokens: 1.5 })).rejects.toThrow(
      "generateStructured: maxOutputTokens",
    );
  });
});
