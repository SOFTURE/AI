// Test double for code that embeds texts with @softure-ai/llm: a model that answers with vectors derived from the words
// of each text, so texts that share words are close and texts that share none are not. Deterministic, no network.
import { APICallError, type EmbeddingModel } from "ai";
import type { EmbedderModel } from "../embeddings.js";

type CallOptions = Parameters<Extract<EmbeddingModel, { readonly specificationVersion: "v4" }>["doEmbed"]>[0];

export interface FakeEmbeddingModelOptions {
  /** Length of every vector. */
  readonly dimensions: number;
  readonly modelId?: string;
  readonly provider?: string;
  /** Texts per call; `embedMany` splits larger requests. Default 32. */
  readonly maxEmbeddingsPerCall?: number;
  /**
   * `unavailable`: every call fails like a provider answering HTTP 503 (`llm.unavailable`); `hang`: no call answers until
   * it is aborted (`llm.timeout`); `wrong-dimensions`: vectors one shorter than `dimensions` (`llm.invalid_output`).
   */
  readonly behaviour?: "answer" | "unavailable" | "hang" | "wrong-dimensions";
}

export type FakeEmbeddingModel = Extract<EmbedderModel, { readonly specificationVersion: "v4" }> & {
  /** The texts of every call, in order. */
  readonly calls: readonly (readonly string[])[];
};

/** A fake embedding model for `createEmbedder({ model })`; usage is one token per word. */
export function fakeEmbeddingModel(options: FakeEmbeddingModelOptions): FakeEmbeddingModel {
  if (!Number.isInteger(options.dimensions) || options.dimensions < 2) throw new RangeError("fakeEmbeddingModel: dimensions must be a whole number of 2 or more");
  const calls: string[][] = [];
  const behaviour = options.behaviour ?? "answer";
  return {
    specificationVersion: "v4",
    provider: options.provider ?? "fake",
    modelId: options.modelId ?? "fake-embedding-model",
    maxEmbeddingsPerCall: options.maxEmbeddingsPerCall ?? 32,
    supportsParallelCalls: false,
    calls,
    doEmbed(call: CallOptions) {
      calls.push([...call.values]);
      if (behaviour === "unavailable") {
        return Promise.reject(
          new APICallError({ message: "fakeEmbeddingModel: unavailable", url: "fake://embeddings", requestBodyValues: call.values, statusCode: 503, isRetryable: false }),
        );
      }
      if (behaviour === "hang") return hangUntilAborted(call.abortSignal);
      const length = behaviour === "wrong-dimensions" ? options.dimensions - 1 : options.dimensions;
      const embeddings = call.values.map((value) => embedWords(value, length));
      const tokens = call.values.reduce((total, value) => total + toWords(value).length, 0);
      return Promise.resolve({ embeddings, usage: { tokens }, warnings: [] });
    },
  };
}

/** The fake's vector for one text: each word adds ±1 to a bucket picked by its hash; the result has length 1. */
export function embedWords(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const word of toWords(text)) {
    const hash = hashWord(word);
    const bucket = hash % dimensions;
    vector[bucket] = (vector[bucket] ?? 0) + ((hash >>> 16) % 2 === 0 ? 1 : -1);
  }
  const norm = Math.hypot(...vector);
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

function toWords(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** FNV-1a, 32 bits. */
function hashWord(word: string): number {
  let hash = 0x811c9dc5;
  for (const char of word) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function hangUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal === undefined) return;
    const fail = () => {
      reject(signal.reason instanceof Error ? signal.reason : new Error("fakeEmbeddingModel: the call was aborted"));
    };
    if (signal.aborted) fail();
    else signal.addEventListener("abort", fail, { once: true });
  });
}
