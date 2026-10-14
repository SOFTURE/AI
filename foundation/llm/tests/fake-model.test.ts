import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlm } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const schema = z.object({ n: z.number() });

describe("fakeModel", () => {
  it("answers each call with the next response and repeats the last one", async () => {
    const llm = createLlm({
      model: fakeModel({ kind: "output", value: { n: 1 } }, { kind: "unavailable" }, { kind: "output", value: { n: 3 } }),
    });

    const results = [];
    for (let call = 0; call < 4; call += 1) results.push(await llm.generateStructured({ schema, prompt: "p" }));

    expect(results.map((result) => (result.ok ? result.value.output.n : result.error))).toEqual([1, "llm.unavailable", 3, 3]);
  });

  it("reports the usage and model id it is given", async () => {
    const model = fakeModel(
      { modelId: "cheap", provider: "fake" },
      { kind: "output", value: { n: 1 }, usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 60 } },
    );
    const result = await createLlm({ model }).generateStructured({ schema, prompt: "p" });

    expect(model.provider).toBe("fake");
    expect(result.ok && result.value.model).toBe("cheap");
    expect(result.ok && result.value.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cachedInputTokens: 60,
      reasoningTokens: 0,
    });
  });

  it("refuses a script without responses", () => {
    expect(() => fakeModel({ modelId: "m" } as never)).toThrow("at least one response");
  });
});
