// Provider adapters: Groq, OpenAI and any OpenAI-compatible endpoint (`POST {baseUrl}/audio/transcriptions`).
import { ok, requestJson, type FetchFunction, type HttpJsonFailure, type Ok } from "@softure-ai/core";
import { z } from "zod";
import type { SpeechFailure, TranscriptSegment } from "./contract.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
/** The upload limit of Groq's free tier and of OpenAI. */
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// The gpt-4o transcription models answer `json` or `text` only: no segments, no duration, no language.
const JSON_ONLY_MODEL = /^gpt-4o.*transcribe/;

/** One chunk of normalized audio, as the transcriber hands it to a provider. */
export interface ProviderChunk {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
  readonly language?: string;
  readonly prompt?: string;
  /** The time limit of this request. */
  readonly timeoutMs: number;
}

/** A provider's transcript of one chunk; times are relative to the chunk. */
export interface ProviderTranscript {
  readonly text: string;
  readonly language: string | null;
  readonly segments: readonly TranscriptSegment[];
}

/** What `createTranscriber` needs from a provider. Write one for a provider the package has no adapter for. */
export interface SpeechProvider {
  /** Reported in usage records and transcripts, e.g. `"groq"`. */
  readonly name: string;
  readonly model: string;
  /** The largest file the provider accepts; the transcriber refuses a bigger chunk as `speech.too_long`. */
  readonly maxUploadBytes: number;
  transcribeChunk(chunk: ProviderChunk): Promise<Ok<ProviderTranscript> | SpeechFailure>;
}

export interface OpenAiCompatibleProviderOptions {
  /** Reported in records, e.g. `"faster-whisper"`. */
  readonly name: string;
  /** The API root the `/audio/transcriptions` path is appended to, e.g. `http://whisper:8000/v1`. */
  readonly baseUrl: string;
  readonly model: string;
  /** Sent as a Bearer token; a function is read on every call. Without one no `Authorization` header is sent. */
  readonly apiKey?: string | (() => string | undefined);
  /** Default 25 MB. */
  readonly maxUploadBytes?: number;
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: FetchFunction;
}

export interface HostedProviderOptions {
  /** Default: the provider's environment variable, read on every call. A missing key is `speech.unavailable`. */
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxUploadBytes?: number;
  readonly fetch?: FetchFunction;
}

const segmentSchema = z.object({ start: z.number(), end: z.number(), text: z.string() });
const answerSchema = z.object({
  text: z.string(),
  language: z.string().nullish(),
  segments: z.array(segmentSchema).nullish(),
});

/** Groq's Whisper endpoint. Default model `whisper-large-v3-turbo`, key `GROQ_API_KEY`. */
export function groqProvider(options: HostedProviderOptions = {}): SpeechProvider {
  return createHostedProvider("groq", GROQ_BASE_URL, "whisper-large-v3-turbo", "GROQ_API_KEY", options);
}

/** OpenAI's transcription endpoint. Default model `whisper-1`, key `OPENAI_API_KEY`. */
export function openAiProvider(options: HostedProviderOptions = {}): SpeechProvider {
  return createHostedProvider("openai", OPENAI_BASE_URL, "whisper-1", "OPENAI_API_KEY", options);
}

/** Any server that speaks OpenAI's transcription API, e.g. a self-hosted faster-whisper. */
export function openAiCompatibleProvider(options: OpenAiCompatibleProviderOptions): SpeechProvider {
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  if (!Number.isInteger(maxUploadBytes) || maxUploadBytes <= 0) {
    throw new RangeError(`${options.name}: maxUploadBytes must be a whole number of 1 or more`);
  }
  if (options.model.trim() === "") throw new RangeError(`${options.name}: model must not be empty`);
  const url = `${trimTrailingSlashes(options.baseUrl)}/audio/transcriptions`;
  const readKey = typeof options.apiKey === "function" ? options.apiKey : () => options.apiKey as string | undefined;
  const isJsonOnly = JSON_ONLY_MODEL.test(options.model);

  async function transcribeChunk(chunk: ProviderChunk): Promise<Ok<ProviderTranscript> | SpeechFailure> {
    const form = new FormData();
    // A copy into a plain ArrayBuffer: `Blob` takes no view over a shared buffer.
    form.append("file", new Blob([new Uint8Array(chunk.bytes)], { type: chunk.mimeType }), chunk.fileName);
    form.append("model", options.model);
    form.append("response_format", isJsonOnly ? "json" : "verbose_json");
    if (!isJsonOnly) form.append("timestamp_granularities[]", "segment");
    if (chunk.language !== undefined) form.append("language", chunk.language);
    if (chunk.prompt !== undefined) form.append("prompt", chunk.prompt);

    const key = readKey();
    const headers: Record<string, string> = {};
    if (key !== undefined && key !== "") headers.authorization = `Bearer ${key}`;

    // Kept to tell a request stopped by its time limit apart from a network failure: both are `core.http_unreachable`.
    let signal: AbortSignal | null | undefined;
    const fetchFunction = options.fetch ?? globalThis.fetch;
    const trackedFetch: FetchFunction = (input, init) => {
      signal = init.signal;
      return fetchFunction(input, init);
    };

    const answer = await requestJson({
      url,
      method: "POST",
      form,
      headers,
      schema: answerSchema,
      timeoutMs: chunk.timeoutMs,
      fetch: trackedFetch,
    });
    if (!answer.ok) return toSpeechFailure(answer, signal?.aborted === true);
    // A write answered with an empty body: nothing to read.
    if (answer.value === undefined) return { ok: false, error: "speech.unavailable" };
    const { text, language, segments } = answer.value;
    return ok({ text: text.trim(), language: language ?? null, segments: segments ?? [] });
  }

  return { name: options.name, model: options.model, maxUploadBytes, transcribeChunk };
}

function createHostedProvider(
  name: string,
  baseUrl: string,
  defaultModel: string,
  keyVariable: string,
  options: HostedProviderOptions,
): SpeechProvider {
  const provider = openAiCompatibleProvider({
    name,
    baseUrl,
    model: options.model ?? defaultModel,
    apiKey: () => options.apiKey ?? process.env[keyVariable],
    ...(options.maxUploadBytes === undefined ? {} : { maxUploadBytes: options.maxUploadBytes }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  return {
    ...provider,
    transcribeChunk: async (chunk) => {
      const key = options.apiKey ?? process.env[keyVariable];
      if (key === undefined || key.trim() === "") return { ok: false, error: "speech.unavailable" };
      return provider.transcribeChunk(chunk);
    },
  };
}

/** Maps a failed HTTP call to a speech code. */
function toSpeechFailure(failure: HttpJsonFailure, isTimedOut: boolean): SpeechFailure {
  switch (failure.error) {
    case "core.http_rate_limited":
      return { ok: false, error: "speech.rate_limited", retryAfterSeconds: failure.retryAfterSeconds };
    case "core.http_refused":
      // 401, 403, or a redirect (never followed).
      return { ok: false, error: "speech.provider_refused" };
    case "core.http_unreachable":
      return { ok: false, error: isTimedOut ? "speech.timeout" : "speech.unavailable" };
    case "core.http_unexpected_answer":
      // core files every 4xx it has no code for here, next to a 2xx whose body could not be read.
      return { ok: false, error: getClientErrorCode(failure.status) };
    case "core.http_unavailable":
    case "core.http_conflict":
      return { ok: false, error: "speech.unavailable" };
  }
}

function getClientErrorCode(status: number | null): Exclude<SpeechFailure["error"], "speech.rate_limited"> {
  if (status === 413) return "speech.too_long";
  if (status === 400 || status === 415) return "speech.unsupported_format";
  if (status !== null && status >= 400 && status < 500) return "speech.provider_refused";
  return "speech.unavailable";
}

/** The URL without trailing slashes; a loop, since an anchored `/+$` backtracks on long runs of slashes. */
function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}
