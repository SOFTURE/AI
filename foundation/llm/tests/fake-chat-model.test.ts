import { streamText } from "ai";
import { describe, expect, it } from "vitest";
import { fakeChatModel } from "../src/testing/index.js";

describe("fakeChatModel", () => {
  it("streams each call's text word by word, and repeats the last response", async () => {
    const model = fakeChatModel({ kind: "text", text: "One two" }, { kind: "text", text: "Three" });

    const texts: string[][] = [];
    for (let call = 0; call < 3; call += 1) {
      const deltas: string[] = [];
      for await (const delta of streamText({ model, prompt: "Hi" }).textStream) deltas.push(delta);
      texts.push(deltas);
    }

    expect(texts).toEqual([["One ", "two"], ["Three"], ["Three"]]);
    expect(model.doStreamCalls).toHaveLength(3);
  });

  it("reports the answered model id, the usage and the provider metadata", async () => {
    const model = fakeChatModel(
      { modelId: "small", provider: "openrouter" },
      { kind: "text", text: "Hi", usage: { inputTokens: 7, outputTokens: 3, cachedInputTokens: 2 }, providerMetadata: { openrouter: { usage: { cost: 0.01 } } } },
    );

    const result = streamText({ model, prompt: "Hi" });

    await result.consumeStream();
    expect((await result.response).modelId).toBe("small");
    expect(await result.providerMetadata).toEqual({ openrouter: { usage: { cost: 0.01 } } });
    const usage = await result.totalUsage;
    expect([usage.inputTokens, usage.outputTokens, usage.inputTokenDetails.cacheReadTokens]).toEqual([7, 3, 2]);
  });

  it("calls a tool and stops with finish reason tool-calls", async () => {
    const model = fakeChatModel({ kind: "tool-call", toolName: "lookup", input: { id: "a" } });

    const result = streamText({ model, prompt: "Hi" });

    expect(await result.toolCalls).toEqual([expect.objectContaining({ toolName: "lookup", input: { id: "a" } })]);
    expect(await result.finishReason).toBe("tool-calls");
  });

  it("stops on the token limit for truncated", async () => {
    const result = streamText({ model: fakeChatModel({ kind: "truncated", text: "Half" }), prompt: "Hi" });

    expect(await result.text).toBe("Half");
    expect(await result.finishReason).toBe("length");
  });

  it("fails before streaming for unavailable and mid-stream for error", async () => {
    const errors: unknown[] = [];
    const onError = ({ error }: { error: unknown }) => void errors.push(error);

    await streamText({ model: fakeChatModel({ kind: "unavailable" }), prompt: "Hi", maxRetries: 0, onError }).consumeStream();
    const partial = streamText({ model: fakeChatModel({ kind: "error", text: "Part" }), prompt: "Hi", onError });
    await partial.consumeStream();

    expect(errors.map((error) => (error as { statusCode?: number }).statusCode)).toEqual([503, 503]);
    expect(await partial.text).toBe("Part");
  });

  it("keeps a hanging answer open until the call is aborted", async () => {
    const controller = new AbortController();
    const aborted: unknown[] = [];
    const result = streamText({
      model: fakeChatModel({ kind: "hang", text: "Wait" }),
      prompt: "Hi",
      abortSignal: controller.signal,
      onAbort: ({ reason }) => void aborted.push(reason),
    });

    for await (const delta of result.textStream) {
      expect(delta).toBe("Wait");
      controller.abort();
    }

    expect(aborted).toHaveLength(1);
  });

  it("throws a RangeError without responses", () => {
    expect(() => (fakeChatModel as (...args: unknown[]) => unknown)({ modelId: "m" })).toThrow(new RangeError("fakeChatModel: pass at least one response"));
  });
});
