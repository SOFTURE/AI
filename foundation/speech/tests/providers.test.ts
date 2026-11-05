import type { FetchFunction } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { groqProvider, openAiCompatibleProvider, openAiProvider } from "../src/index.js";
import type { ProviderChunk } from "../src/providers.js";

const chunk: ProviderChunk = {
  bytes: new Uint8Array([1, 2, 3]),
  fileName: "chunk-0.flac",
  mimeType: "audio/flac",
  timeoutMs: 5_000,
};

interface SentRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly form: FormData;
}

function answering(response: () => Response): { fetch: FetchFunction; sent: SentRequest[] } {
  const sent: SentRequest[] = [];
  const fetch: FetchFunction = (input, init) => {
    sent.push({ url: String(input), headers: new Headers(init.headers), form: init.body as FormData });
    return Promise.resolve(response());
  };
  return { fetch, sent };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const verbose = {
  text: " Hello world. ",
  language: "english",
  duration: 3.2,
  segments: [{ id: 0, start: 0, end: 3.2, text: " Hello world.", avg_logprob: -0.2 }],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("openAiCompatibleProvider", () => {
  it("posts the chunk with the model, verbose_json and segment timestamps, and reads the segments", async () => {
    const { fetch, sent } = answering(() => json(verbose));
    const provider = openAiCompatibleProvider({ name: "local", baseUrl: "http://whisper:8000/v1/", model: "large-v3", fetch });

    const result = await provider.transcribeChunk({ ...chunk, language: "en", prompt: "Recipe vocabulary" });

    expect(result).toEqual({
      ok: true,
      value: { text: "Hello world.", language: "english", segments: [{ start: 0, end: 3.2, text: " Hello world." }] },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("http://whisper:8000/v1/audio/transcriptions");
    expect(sent[0]?.headers.has("authorization")).toBe(false);
    const form = sent[0]?.form;
    expect(form?.get("model")).toBe("large-v3");
    expect(form?.get("response_format")).toBe("verbose_json");
    expect(form?.getAll("timestamp_granularities[]")).toEqual(["segment"]);
    expect(form?.get("language")).toBe("en");
    expect(form?.get("prompt")).toBe("Recipe vocabulary");
    const file = form?.get("file") as File;
    expect(file.name).toBe("chunk-0.flac");
    expect(file.type).toBe("audio/flac");
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(provider).toMatchObject({ name: "local", model: "large-v3", maxUploadBytes: 25 * 1024 * 1024 });
  });

  it("asks the gpt-4o transcription models for json and gets no segments or language", async () => {
    const { fetch, sent } = answering(() => json({ text: "Plain." }));
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "gpt-4o-mini-transcribe", fetch });

    expect(await provider.transcribeChunk(chunk)).toEqual({ ok: true, value: { text: "Plain.", language: null, segments: [] } });
    expect(sent[0]?.form.get("response_format")).toBe("json");
    expect(sent[0]?.form.has("timestamp_granularities[]")).toBe(false);
  });

  it("sends a key from a function as a Bearer token", async () => {
    const { fetch, sent } = answering(() => json(verbose));
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", apiKey: () => "k-1", fetch });

    await provider.transcribeChunk(chunk);

    expect(sent[0]?.headers.get("authorization")).toBe("Bearer k-1");
  });

  it.each([
    [413, "speech.too_long"],
    [400, "speech.unsupported_format"],
    [415, "speech.unsupported_format"],
    [401, "speech.provider_refused"],
    [403, "speech.provider_refused"],
    [404, "speech.provider_refused"],
    [500, "speech.unavailable"],
    [503, "speech.unavailable"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const { fetch } = answering(() => json({ error: { message: "no" } }, status));
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch });

    expect(await provider.transcribeChunk(chunk)).toEqual({ ok: false, error: code });
  });

  it("maps HTTP 429 to speech.rate_limited with the Retry-After seconds", async () => {
    const { fetch } = answering(() => json({}, 429, { "retry-after": "7" }));
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch });

    expect(await provider.transcribeChunk(chunk)).toEqual({ ok: false, error: "speech.rate_limited", retryAfterSeconds: 7 });
  });

  it("maps an answer of the wrong shape and a network failure to speech.unavailable", async () => {
    const wrong = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch: answering(() => json({ txt: 1 })).fetch });
    const down = openAiCompatibleProvider({
      name: "o",
      baseUrl: "https://x.test/v1",
      model: "m",
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });

    expect(await wrong.transcribeChunk(chunk)).toEqual({ ok: false, error: "speech.unavailable" });
    expect(await down.transcribeChunk(chunk)).toEqual({ ok: false, error: "speech.unavailable" });
  });

  it("maps a request stopped by its time limit to speech.timeout", async () => {
    const hang: FetchFunction = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason as Error), { once: true });
      });
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch: hang });

    expect(await provider.transcribeChunk({ ...chunk, timeoutMs: 20 })).toEqual({ ok: false, error: "speech.timeout" });
  });

  it("cancels the request in flight when the chunk's signal aborts, as speech.aborted", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | null | undefined;
    const hang: FetchFunction = (_input, init) =>
      new Promise((_resolve, reject) => {
        seen = init.signal;
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason as Error), { once: true });
        controller.abort();
      });
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch: hang });

    expect(await provider.transcribeChunk({ ...chunk, signal: controller.signal })).toEqual({ ok: false, error: "speech.aborted" });
    expect(seen?.aborted).toBe(true);
  });

  it("sends nothing when the chunk's signal is already aborted", async () => {
    const { fetch, sent } = answering(() => Response.json({ text: "x" }));
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch });

    expect(await provider.transcribeChunk({ ...chunk, signal: AbortSignal.abort() })).toEqual({ ok: false, error: "speech.aborted" });
    expect(sent).toEqual([]);
  });

  it("still maps the time limit to speech.timeout when the chunk has a signal that did not abort", async () => {
    const hang: FetchFunction = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason as Error), { once: true });
      });
    const provider = openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test/v1", model: "m", fetch: hang });

    expect(await provider.transcribeChunk({ ...chunk, timeoutMs: 20, signal: new AbortController().signal })).toEqual({
      ok: false,
      error: "speech.timeout",
    });
  });

  it("refuses an empty model and a non-positive upload limit", () => {
    expect(() => openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test", model: " " })).toThrow(RangeError);
    expect(() => openAiCompatibleProvider({ name: "o", baseUrl: "https://x.test", model: "m", maxUploadBytes: 0 })).toThrow(
      "o: maxUploadBytes must be a whole number of 1 or more",
    );
  });
});

describe("groqProvider and openAiProvider", () => {
  it("call their hosts with their default models and the key from the environment, read on every call", async () => {
    const groq = answering(() => json(verbose));
    const openai = answering(() => json(verbose));
    vi.stubEnv("GROQ_API_KEY", "g-1");
    vi.stubEnv("OPENAI_API_KEY", "o-1");
    const groqSpeech = groqProvider({ fetch: groq.fetch });
    const openaiSpeech = openAiProvider({ fetch: openai.fetch });
    vi.stubEnv("GROQ_API_KEY", "g-2");

    await groqSpeech.transcribeChunk(chunk);
    await openaiSpeech.transcribeChunk(chunk);

    expect(groqSpeech).toMatchObject({ name: "groq", model: "whisper-large-v3-turbo" });
    expect(groq.sent[0]?.url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(groq.sent[0]?.headers.get("authorization")).toBe("Bearer g-2");
    expect(openaiSpeech).toMatchObject({ name: "openai", model: "whisper-1" });
    expect(openai.sent[0]?.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(openai.sent[0]?.headers.get("authorization")).toBe("Bearer o-1");
  });

  it("prefer a key passed in the options and take another model", async () => {
    const { fetch, sent } = answering(() => json(verbose));
    vi.stubEnv("OPENAI_API_KEY", "env");

    await openAiProvider({ apiKey: "given", model: "gpt-4o-transcribe", fetch }).transcribeChunk(chunk);

    expect(sent[0]?.headers.get("authorization")).toBe("Bearer given");
    expect(sent[0]?.form.get("model")).toBe("gpt-4o-transcribe");
  });

  it("return speech.unavailable without a key and send nothing", async () => {
    const { fetch, sent } = answering(() => json(verbose));
    vi.stubEnv("GROQ_API_KEY", "");

    expect(await groqProvider({ fetch }).transcribeChunk(chunk)).toEqual({ ok: false, error: "speech.unavailable" });
    expect(sent).toHaveLength(0);
  });
});
