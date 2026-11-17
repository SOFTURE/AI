// Two embedding models built without a provider package, for `createEmbedder`: Workers AI through its binding (the
// Cloudflare host) and any OpenAI-compatible `/embeddings` endpoint (a self-hosted model server or a hosted API). Both
// answer AI SDK's embedding model contract, and fail with AI SDK's `APICallError`, so `embedTexts` maps a failure to
// `llm.unavailable` and retries the retryable ones.
import { APICallError, type EmbeddingModel } from "ai";
import type { EmbedderModel } from "./embeddings.js";

type CallOptions = Parameters<Extract<EmbeddingModel, { readonly specificationVersion: "v4" }>["doEmbed"]>[0];

/** The part of a Workers AI binding (`env.AI`) the model uses. */
export interface WorkersAiBinding {
  run(model: string, input: { readonly text: readonly string[] }, options?: Record<string, unknown>): Promise<unknown>;
}

export interface WorkersAiEmbeddingModelOptions {
  /** `env.AI` of a Worker with an `ai` binding. */
  readonly binding: WorkersAiBinding;
  /** A Workers AI text embedding model, e.g. `@cf/baai/bge-m3`. */
  readonly model: string;
  /** Texts per call. Default 100, the batch limit of Workers AI's text embedding models. */
  readonly maxEmbeddingsPerCall?: number;
}

const WORKERS_AI_URL = "workers-ai://binding";

/**
 * An embedding model on Workers AI, called through the Worker's binding (no API token). Workers AI reports no token
 * counts for embeddings, so `usage` is 0 and `costUsd` is `null`: estimate the cost from the text length.
 */
export function workersAiEmbeddingModel(options: WorkersAiEmbeddingModelOptions): EmbedderModel {
  const maxEmbeddingsPerCall = options.maxEmbeddingsPerCall ?? 100;
  assertBatch(maxEmbeddingsPerCall, "workersAiEmbeddingModel");
  return {
    specificationVersion: "v4",
    provider: "workers-ai",
    modelId: options.model,
    maxEmbeddingsPerCall,
    supportsParallelCalls: true,
    async doEmbed(call: CallOptions) {
      const requestBodyValues = { text: call.values };
      let answer: unknown;
      try {
        answer = await options.binding.run(options.model, requestBodyValues, call.abortSignal === undefined ? undefined : { signal: call.abortSignal });
      } catch (cause) {
        // The binding throws plain errors (capacity, an outage, a bad input): all are worth one more try.
        throw new APICallError({ message: "Workers AI embedding call failed", url: WORKERS_AI_URL, requestBodyValues, cause, isRetryable: true });
      }
      const data = readVectors(answer, "data");
      if (data === null) {
        throw new APICallError({ message: "Workers AI answered without vectors", url: WORKERS_AI_URL, requestBodyValues, isRetryable: false, data: answer });
      }
      return { embeddings: data, warnings: [] };
    },
  };
}

export interface OpenAiCompatibleEmbeddingModelOptions {
  /** The API's base URL, e.g. `https://api.openai.com/v1` or `http://ollama:11434/v1`; `/embeddings` is appended. */
  readonly baseUrl: string;
  readonly model: string;
  /** Sent as a bearer token when given. */
  readonly apiKey?: string;
  /** Asks the API for vectors of this length (models that can shorten them, such as OpenAI's `text-embedding-3`). */
  readonly dimensions?: number;
  /** Texts per call. Default 96. */
  readonly maxEmbeddingsPerCall?: number;
  /** The provider name in records and spans. Default `openai-compatible`. */
  readonly provider?: string;
  readonly fetch?: typeof globalThis.fetch;
}

/** An embedding model behind any OpenAI-compatible `POST /embeddings` endpoint. */
export function openAiCompatibleEmbeddingModel(options: OpenAiCompatibleEmbeddingModelOptions): EmbedderModel {
  const maxEmbeddingsPerCall = options.maxEmbeddingsPerCall ?? 96;
  assertBatch(maxEmbeddingsPerCall, "openAiCompatibleEmbeddingModel");
  const url = `${options.baseUrl.replace(/\/+$/, "")}/embeddings`;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    specificationVersion: "v4",
    provider: options.provider ?? "openai-compatible",
    modelId: options.model,
    maxEmbeddingsPerCall,
    supportsParallelCalls: true,
    async doEmbed(call: CallOptions) {
      const requestBodyValues = {
        model: options.model,
        input: call.values,
        encoding_format: "float",
        ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions }),
      };
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(options.apiKey === undefined || options.apiKey === "" ? {} : { authorization: `Bearer ${options.apiKey}` }),
          },
          body: JSON.stringify(requestBodyValues),
          ...(call.abortSignal === undefined ? {} : { signal: call.abortSignal }),
        });
      } catch (cause) {
        if (call.abortSignal?.aborted === true) throw cause;
        throw new APICallError({ message: "The embedding endpoint could not be reached", url, requestBodyValues, cause, isRetryable: true });
      }
      if (!response.ok) {
        throw new APICallError({
          message: `The embedding endpoint answered HTTP ${String(response.status)}`,
          url,
          requestBodyValues,
          statusCode: response.status,
          isRetryable: response.status === 408 || response.status === 429 || response.status >= 500,
        });
      }
      const body: unknown = await response.json().catch(() => null);
      const embeddings = readOpenAiVectors(body);
      if (embeddings === null) {
        throw new APICallError({ message: "The embedding endpoint answered without vectors", url, requestBodyValues, statusCode: response.status, isRetryable: false });
      }
      const tokens = readTokens(body);
      return { embeddings, ...(tokens === null ? {} : { usage: { tokens } }), warnings: [] };
    },
  };
}

function readVectors(value: unknown, key: string): number[][] | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Record<string, unknown>)[key];
  if (!Array.isArray(data)) return null;
  return data.every(isVector) ? data : null;
}

/** `{ data: [{ embedding, index }] }`, put back in input order by `index`. */
function readOpenAiVectors(value: unknown): number[][] | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as Record<string, unknown>).data;
  if (!Array.isArray(data)) return null;
  const rows: { index: number; embedding: number[] }[] = [];
  for (const [position, row] of data.entries()) {
    if (typeof row !== "object" || row === null) return null;
    const { embedding, index } = row as Record<string, unknown>;
    if (!isVector(embedding)) return null;
    rows.push({ index: typeof index === "number" ? index : position, embedding });
  }
  return rows.sort((left, right) => left.index - right.index).map((row) => row.embedding);
}

function readTokens(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const usage = (value as Record<string, unknown>).usage;
  if (typeof usage !== "object" || usage === null) return null;
  const { prompt_tokens: prompt, total_tokens: total } = usage as Record<string, unknown>;
  const tokens = typeof prompt === "number" ? prompt : total;
  return typeof tokens === "number" && Number.isFinite(tokens) && tokens >= 0 ? tokens : null;
}

function isVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function assertBatch(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name}: maxEmbeddingsPerCall must be a whole number of 1 or more`);
}
