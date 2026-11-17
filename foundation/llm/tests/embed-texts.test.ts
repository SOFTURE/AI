import { createTestClock } from "@softure-ai/core";
import { describe, expect, it } from "vitest";
import {
  createEmbedder,
  openAiCompatibleEmbeddingModel,
  workersAiEmbeddingModel,
  type LlmCallRecord,
  type UsageRecord,
  type WorkersAiBinding,
} from "../src/index.js";
import { embedWords, fakeEmbeddingModel } from "../src/testing/index.js";

const START = new Date("2026-11-17T12:00:00Z");

function cosine(left: readonly number[], right: readonly number[]): number {
  return left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);
}

describe("embedTexts", () => {
  it("answers one vector per text in order, with token usage, cost from the price table and both records", async () => {
    const usage: UsageRecord[] = [];
    const calls: LlmCallRecord[] = [];
    const model = fakeEmbeddingModel({ dimensions: 8, modelId: "fake-embed", maxEmbeddingsPerCall: 2 });
    const embedder = createEmbedder({
      model,
      dimensions: 8,
      pricing: { "fake-embed": { inputPerMillion: 2, outputPerMillion: 0 } },
      onUsage: (record) => void usage.push(record),
      onCall: (record) => void calls.push(record),
      clock: createTestClock(START),
    });

    const result = await embedder.embedTexts({ values: ["alpha beta", "gamma", "delta epsilon zeta"], attributes: { accountId: "a1" } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.embeddings).toEqual([embedWords("alpha beta", 8), embedWords("gamma", 8), embedWords("delta epsilon zeta", 8)]);
    expect(result.value.usage).toEqual({ inputTokens: 6, outputTokens: 0, totalTokens: 6, cachedInputTokens: 0, reasoningTokens: 0 });
    expect(result.value).toMatchObject({ model: "fake-embed", costUsd: 0.000012, costSource: "price_table" });
    // The SDK split the three texts into calls of at most two.
    expect(model.calls).toEqual([["alpha beta", "gamma"], ["delta epsilon zeta"]]);
    expect(usage).toEqual([
      {
        model: "fake-embed",
        provider: "fake",
        usage: result.value.usage,
        costUsd: 0.000012,
        costSource: "price_table",
        outcome: "ok",
        durationMs: 0,
        at: START,
        attributes: { accountId: "a1" },
      },
    ]);
    expect(calls).toEqual([
      {
        operation: "embedTexts",
        model: "fake-embed",
        provider: "fake",
        outcome: "ok",
        usage: result.value.usage,
        costUsd: 0.000012,
        costSource: "price_table",
        startedAt: START,
        durationMs: 0,
        attributes: { accountId: "a1" },
      },
    ]);
    expect(embedder).toMatchObject({ modelId: "fake-embed", dimensions: 8 });
  });

  it("makes no call for no texts", async () => {
    const model = fakeEmbeddingModel({ dimensions: 4 });
    const result = await createEmbedder({ model, dimensions: 4 }).embedTexts({ values: [] });
    expect(result).toEqual({
      ok: true,
      value: { embeddings: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 }, model: "fake-embedding-model", costUsd: null, costSource: null },
    });
    expect(model.calls).toEqual([]);
  });

  it("fails with llm.invalid_output when the vectors have another length than the app's column", async () => {
    const calls: LlmCallRecord[] = [];
    const embedder = createEmbedder({
      model: fakeEmbeddingModel({ dimensions: 8, behaviour: "wrong-dimensions" }),
      dimensions: 8,
      onCall: (record) => void calls.push(record),
    });
    expect(await embedder.embedTexts({ values: ["one"] })).toEqual({ ok: false, error: "llm.invalid_output" });
    expect(calls.map((record) => record.outcome)).toEqual(["llm.invalid_output"]);
  });

  it("fails with llm.unavailable when the provider fails", async () => {
    const embedder = createEmbedder({ model: fakeEmbeddingModel({ dimensions: 4, behaviour: "unavailable" }), dimensions: 4, maxRetries: 0 });
    expect(await embedder.embedTexts({ values: ["one"] })).toEqual({ ok: false, error: "llm.unavailable" });
  });

  it("fails with llm.timeout when the provider does not answer in time, with no usage record", async () => {
    const usage: UsageRecord[] = [];
    const embedder = createEmbedder({
      model: fakeEmbeddingModel({ dimensions: 4, behaviour: "hang" }),
      dimensions: 4,
      timeoutMs: 20,
      onUsage: (record) => void usage.push(record),
    });
    expect(await embedder.embedTexts({ values: ["one"] })).toEqual({ ok: false, error: "llm.timeout" });
    expect(usage).toEqual([]);
  });

  it("refuses invalid options with a RangeError naming the option", () => {
    const model = fakeEmbeddingModel({ dimensions: 4 });
    expect(() => createEmbedder({ model, dimensions: 0 })).toThrow("createEmbedder: dimensions must be a whole number of 1 or more");
    expect(() => createEmbedder({ model, dimensions: 4, timeoutMs: 0 })).toThrow("createEmbedder: timeoutMs must be a positive number of milliseconds");
    expect(() => createEmbedder({ model, dimensions: 4, maxRetries: -1 })).toThrow("createEmbedder: maxRetries must be a whole number of 0 or more");
    expect(() => createEmbedder({ model, dimensions: 4, pricing: { m: { inputPerMillion: -1, outputPerMillion: 0 } } })).toThrow(
      'createEmbedder: pricing["m"] must hold prices of 0 or more',
    );
  });
});

describe("fakeEmbeddingModel", () => {
  it("puts texts that share words closer than texts that share none, whatever the accents and case", () => {
    const query = embedWords("Treffen mit dem Kunden", 64);
    expect(cosine(query, embedWords("treffen KUNDEN am Mittwoch", 64))).toBeGreaterThan(cosine(query, embedWords("Budget for next year", 64)));
    expect(cosine(embedWords("Zürich", 64), embedWords("zurich", 64))).toBeCloseTo(1, 10);
  });
});

describe("workersAiEmbeddingModel", () => {
  it("sends the texts to the binding in batches and reads the vectors", async () => {
    const inputs: { model: string; text: readonly string[] }[] = [];
    const binding: WorkersAiBinding = {
      run: (model, input) => {
        inputs.push({ model, text: input.text });
        return Promise.resolve({ shape: [input.text.length, 2], data: input.text.map((_, index) => [index, 1]), pooling: "cls" });
      },
    };
    const embedder = createEmbedder({ model: workersAiEmbeddingModel({ binding, model: "@cf/baai/bge-m3", maxEmbeddingsPerCall: 2 }), dimensions: 2 });

    const result = await embedder.embedTexts({ values: ["a", "b", "c"] });

    expect(result).toMatchObject({ ok: true, value: { embeddings: [[0, 1], [1, 1], [0, 1]], model: "@cf/baai/bge-m3", costUsd: null } });
    expect(inputs).toEqual([
      { model: "@cf/baai/bge-m3", text: ["a", "b"] },
      { model: "@cf/baai/bge-m3", text: ["c"] },
    ]);
  });

  it("maps a throwing binding to llm.unavailable after its retries", async () => {
    let attempts = 0;
    const binding: WorkersAiBinding = {
      run: () => {
        attempts += 1;
        return Promise.reject(new Error("3040: Capacity temporarily exceeded"));
      },
    };
    const embedder = createEmbedder({ model: workersAiEmbeddingModel({ binding, model: "m" }), dimensions: 2, maxRetries: 1 });
    expect(await embedder.embedTexts({ values: ["a"] })).toEqual({ ok: false, error: "llm.unavailable" });
    expect(attempts).toBe(2);
  });

  it("maps an answer without vectors to llm.unavailable", async () => {
    const binding: WorkersAiBinding = { run: () => Promise.resolve({ request_id: "queued" }) };
    const embedder = createEmbedder({ model: workersAiEmbeddingModel({ binding, model: "m" }), dimensions: 2, maxRetries: 0 });
    expect(await embedder.embedTexts({ values: ["a"] })).toEqual({ ok: false, error: "llm.unavailable" });
  });
});

describe("openAiCompatibleEmbeddingModel", () => {
  it("posts the texts with the key and dimensions and reads vectors in input order with the token count", async () => {
    const requests: { url: string; headers: Headers; body: unknown }[] = [];
    const fetch: typeof globalThis.fetch = (url, init) => {
      requests.push({ url: url instanceof Request ? url.url : url.toString(), headers: new Headers(init?.headers), body: JSON.parse(typeof init?.body === "string" ? init.body : "null") as unknown });
      return Promise.resolve(
        Response.json({
          data: [
            { index: 1, embedding: [0, 1] },
            { index: 0, embedding: [1, 0] },
          ],
          usage: { prompt_tokens: 7, total_tokens: 7 },
        }),
      );
    };
    const embedder = createEmbedder({
      model: openAiCompatibleEmbeddingModel({ baseUrl: "https://embeddings.example/v1/", model: "text-embed", apiKey: "k-1", dimensions: 2, fetch }),
      dimensions: 2,
    });

    const result = await embedder.embedTexts({ values: ["first", "second"] });

    expect(result).toMatchObject({ ok: true, value: { embeddings: [[1, 0], [0, 1]], usage: { inputTokens: 7 }, model: "text-embed" } });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://embeddings.example/v1/embeddings");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer k-1");
    expect(requests[0]?.body).toEqual({ model: "text-embed", input: ["first", "second"], encoding_format: "float", dimensions: 2 });
  });

  it("sends no authorization header without a key", async () => {
    let authorization: string | null = "unset";
    const fetch: typeof globalThis.fetch = (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return Promise.resolve(Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
    };
    const embedder = createEmbedder({ model: openAiCompatibleEmbeddingModel({ baseUrl: "http://ollama:11434/v1", model: "bge-m3", fetch }), dimensions: 2 });
    expect((await embedder.embedTexts({ values: ["x"] })).ok).toBe(true);
    expect(authorization).toBeNull();
  });

  it("retries a 503 and gives up on a 401 at once, both as llm.unavailable", async () => {
    const statuses: number[] = [];
    const answer = (status: number): typeof globalThis.fetch => () => {
      statuses.push(status);
      return Promise.resolve(new Response("nope", { status }));
    };
    const overloaded = createEmbedder({ model: openAiCompatibleEmbeddingModel({ baseUrl: "https://e.example", model: "m", fetch: answer(503) }), dimensions: 2, maxRetries: 1 });
    expect(await overloaded.embedTexts({ values: ["x"] })).toEqual({ ok: false, error: "llm.unavailable" });
    expect(statuses).toEqual([503, 503]);
    statuses.length = 0;
    const refused = createEmbedder({ model: openAiCompatibleEmbeddingModel({ baseUrl: "https://e.example", model: "m", fetch: answer(401) }), dimensions: 2, maxRetries: 1 });
    expect(await refused.embedTexts({ values: ["x"] })).toEqual({ ok: false, error: "llm.unavailable" });
    expect(statuses).toEqual([401]);
  });

  it("refuses a batch size below 1", () => {
    expect(() => openAiCompatibleEmbeddingModel({ baseUrl: "https://e.example", model: "m", maxEmbeddingsPerCall: 0 })).toThrow(
      "openAiCompatibleEmbeddingModel: maxEmbeddingsPerCall must be a whole number of 1 or more",
    );
  });
});
