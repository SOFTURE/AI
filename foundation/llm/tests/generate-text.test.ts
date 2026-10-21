import { createTestClock } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLlm, type UsageRecord } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const START = new Date("2026-10-21T12:00:00Z");
const USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0, reasoningTokens: 0 };

function captureUsage(): { records: UsageRecord[]; onUsage: (record: UsageRecord) => void } {
  const records: UsageRecord[] = [];
  return { records, onUsage: (record) => void records.push(record) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("generateText", () => {
  it("returns the trimmed text with usage, model and cost, and records the usage", async () => {
    const usage = captureUsage();
    const llm = createLlm({
      model: fakeModel({ modelId: "small" }, { kind: "text", text: "\n  # Summary\n\nTwo lines.  \n" }),
      pricing: { small: { inputPerMillion: 1, outputPerMillion: 4 } },
      onUsage: usage.onUsage,
      clock: createTestClock(START),
    });

    const result = await llm.generateText({ system: "Summarise.", prompt: "Mail", attributes: { accountId: "a1" } });

    expect(result).toEqual({
      ok: true,
      value: { text: "# Summary\n\nTwo lines.", truncated: false, usage: USAGE, model: "small", costUsd: 0.00003 },
    });
    expect(usage.records).toEqual([
      {
        model: "small",
        provider: "mock-provider",
        usage: USAGE,
        costUsd: 0.00003,
        outcome: "ok",
        durationMs: 0,
        at: START,
        attributes: { accountId: "a1" },
      },
    ]);
  });

  it("sends the system text, the prompt and the token limit, and asks for text rather than JSON", async () => {
    const model = fakeModel({ kind: "text", text: "Title" });
    const llm = createLlm({ model });

    await llm.generateText({ system: "Name the file.", prompt: "Invoice text", maxOutputTokens: 20 });

    const [call] = model.doGenerateCalls;
    expect(call?.responseFormat).toBeUndefined();
    expect(call?.maxOutputTokens).toBe(20);
    expect(JSON.stringify(call?.prompt)).toContain("Name the file.");
    expect(JSON.stringify(call?.prompt)).toContain("Invoice text");
  });

  it.each([
    ["cuts at the last whitespace inside the limit", "alpha beta gamma", 12, "alpha beta"],
    ["keeps the whole last word when the limit ends on a word boundary", "alpha beta gamma", 10, "alpha beta"],
    ["cuts hard when the text has no whitespace", "abcdefghij", 4, "abcd"],
    ["counts characters, not UTF-16 units", "😀😀😀", 2, "😀😀"],
  ])("maxChars %s", async (_case, text, maxChars, expected) => {
    const llm = createLlm({ model: fakeModel({ kind: "text", text }) });

    const result = await llm.generateText({ prompt: "p", maxChars });

    expect(result.ok && [result.value.text, result.value.truncated]).toEqual([expected, true]);
  });

  it("leaves a text of exactly maxChars characters untouched", async () => {
    const llm = createLlm({ model: fakeModel({ kind: "text", text: "  exact  " }) });

    const result = await llm.generateText({ prompt: "p", maxChars: 5 });

    expect(result.ok && [result.value.text, result.value.truncated]).toEqual(["exact", false]);
  });

  it("returns llm.invalid_output for an empty answer and still records the spent tokens", async () => {
    const usage = captureUsage();
    const llm = createLlm({ model: fakeModel({ kind: "text", text: " \n\t" }), onUsage: usage.onUsage });

    const result = await llm.generateText({ prompt: "p" });

    expect(result).toEqual({ ok: false, error: "llm.invalid_output" });
    expect(usage.records.map((record) => [record.outcome, record.usage.totalTokens])).toEqual([["llm.invalid_output", 15]]);
  });

  it("returns llm.output_truncated when the model stops on the token limit, and records the usage", async () => {
    const usage = captureUsage();
    const llm = createLlm({
      model: fakeModel({ kind: "truncated", text: "A long answer that", usage: { inputTokens: 7, outputTokens: 20 } }),
      onUsage: usage.onUsage,
    });

    const result = await llm.generateText({ prompt: "p", maxOutputTokens: 20 });

    expect(result).toEqual({ ok: false, error: "llm.output_truncated" });
    expect(usage.records.map((record) => [record.outcome, record.usage.outputTokens])).toEqual([["llm.output_truncated", 20]]);
  });

  it("returns llm.unavailable when the provider fails, and records no usage", async () => {
    const usage = captureUsage();
    const llm = createLlm({ model: fakeModel({ kind: "unavailable" }), onUsage: usage.onUsage, maxRetries: 0 });

    expect(await llm.generateText({ prompt: "p" })).toEqual({ ok: false, error: "llm.unavailable" });
    expect(usage.records).toEqual([]);
  });

  it("returns llm.timeout when the model does not answer in time, and aborts the call", async () => {
    vi.useFakeTimers();
    const model = fakeModel({ kind: "hang" });
    const llm = createLlm({ model, timeoutMs: 60_000 });

    const pending = llm.generateText({ prompt: "p", timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ ok: false, error: "llm.timeout" });
    expect(model.doGenerateCalls[0]?.abortSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("takes the model of one call over the default", async () => {
    const fallback = fakeModel({ modelId: "default" }, { kind: "text", text: "a" });
    const special = fakeModel({ modelId: "special" }, { kind: "text", text: "b" });

    const result = await createLlm({ model: fallback }).generateText({ prompt: "p", model: special });

    expect(result.ok && [result.value.model, result.value.text]).toEqual(["special", "b"]);
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });

  it.each([
    [{ maxChars: 0 }, "generateText: maxChars"],
    [{ maxChars: 2.5 }, "generateText: maxChars"],
    [{ maxOutputTokens: 0 }, "generateText: maxOutputTokens"],
    [{ timeoutMs: -1 }, "generateText: timeoutMs"],
  ])("refuses %o naming %s, before calling the model", async (fields, name) => {
    const model = fakeModel({ kind: "text", text: "a" });

    const call = createLlm({ model }).generateText({ prompt: "p", ...fields });

    await expect(call).rejects.toThrow(RangeError);
    await expect(call).rejects.toThrow(name);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
