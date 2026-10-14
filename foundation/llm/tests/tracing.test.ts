import { SpanStatusCode } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlm } from "../src/index.js";
import { fakeModel } from "../src/testing/index.js";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
const tracer = provider.getTracer("test");
const schema = z.object({ verdict: z.string() });

afterEach(() => {
  exporter.reset();
});

afterAll(async () => {
  await provider.shutdown();
});

describe("spans", () => {
  it("record the model, the tokens, the cost and the outcome of a call, never the prompt or attributes", async () => {
    const llm = createLlm({
      model: fakeModel({ modelId: "small", provider: "openrouter" }, { kind: "output", value: { verdict: "secret answer" } }),
      pricing: { small: { inputPerMillion: 1, outputPerMillion: 1 } },
      tracer,
    });

    await llm.generateStructured({ schema, prompt: "private prompt", attributes: { accountId: "acc-1" } });

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("llm.generate_structured");
    expect(span?.attributes).toEqual({
      "gen_ai.operation.name": "generate_content",
      "gen_ai.provider.name": "openrouter",
      "gen_ai.request.model": "small",
      "gen_ai.response.model": "small",
      "gen_ai.usage.input_tokens": 10,
      "gen_ai.usage.output_tokens": 5,
      "softure.llm.cost_usd": 0.000015,
      "softure.llm.outcome": "ok",
    });
    expect(span?.status.code).toBe(SpanStatusCode.OK);
    expect(JSON.stringify(span?.attributes)).not.toMatch(/private prompt|secret answer|acc-1/);
  });

  it("mark a failed call as an error with its code", async () => {
    const llm = createLlm({ model: fakeModel({ kind: "unavailable" }), tracer });

    await llm.generateStructured({ schema, prompt: "p" });

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes["softure.llm.outcome"]).toBe("llm.unavailable");
    expect(span?.status).toEqual({ code: SpanStatusCode.ERROR, message: "llm.unavailable" });
  });

  it("record an unexpected error and end the span", async () => {
    const model = fakeModel({ kind: "output", value: { verdict: "x" } });
    model.doGenerate = () => Promise.reject(new TypeError("bug"));

    await expect(createLlm({ model, tracer }).generateStructured({ schema, prompt: "p" })).rejects.toThrow("bug");

    const [span] = exporter.getFinishedSpans();
    expect(span?.status).toEqual({ code: SpanStatusCode.ERROR, message: "unexpected error" });
    expect(span?.events.map((event) => event.name)).toEqual(["exception"]);
  });
});
