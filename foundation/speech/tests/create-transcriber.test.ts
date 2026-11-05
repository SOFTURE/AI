import { createTestClock, ok } from "@softure-ai/core";
import { describe, expect, it } from "vitest";
import {
  createTranscriber,
  type AudioNormalizer,
  type ProviderChunk,
  type ProviderTranscript,
  type SpeechFailure,
  type SpeechProvider,
  type SpeechUsageRecord,
} from "../src/index.js";
import { planChunks } from "../src/ffmpeg.js";

const OPTIONS = { chunkSeconds: 10, overlapSeconds: 2 };

/** A normalizer that pretends the input lasts `durationSeconds`, with chunk files of `chunkBytes` bytes. */
function fakeNormalizer(durationSeconds: number, chunkBytes = 100): AudioNormalizer & { disposed: number } {
  const state = {
    disposed: 0,
    normalize: (_input: unknown, options: { maxDurationSeconds: number; chunkSeconds: number; overlapSeconds: number }) => {
      if (durationSeconds > options.maxDurationSeconds) return Promise.resolve({ ok: false as const, error: "speech.too_long" as const });
      const chunks = planChunks(durationSeconds, options).map((span, index) => ({
        ...span,
        read: () => Promise.resolve({ bytes: new Uint8Array(chunkBytes), fileName: `chunk-${String(index)}.flac`, mimeType: "audio/flac" }),
      }));
      return Promise.resolve(
        ok({
          durationSeconds,
          chunks,
          dispose: () => {
            state.disposed += 1;
            return Promise.resolve();
          },
        }),
      );
    },
  };
  return state;
}

type Answer = ProviderTranscript | SpeechFailure;

function fakeProvider(answers: Answer[], maxUploadBytes = 1_000): SpeechProvider & { chunks: ProviderChunk[] } {
  const chunks: ProviderChunk[] = [];
  return {
    name: "groq",
    model: "whisper-large-v3-turbo",
    maxUploadBytes,
    chunks,
    transcribeChunk: (chunk) => {
      const answer = answers[Math.min(chunks.length, answers.length - 1)]!;
      chunks.push(chunk);
      return Promise.resolve("ok" in answer ? answer : ok(answer));
    },
  };
}

const request = { input: { kind: "file" as const, path: "/media/note.m4a" }, purpose: "voice-note" };

describe("createTranscriber", () => {
  it("transcribes a short input in one request and returns the transcript with its cost", async () => {
    const provider = fakeProvider([{ text: "Hi there.", language: "english", segments: [{ start: 0.2, end: 1.8, text: " Hi there." }] }]);
    const normalizer = fakeNormalizer(6);
    const transcriber = createTranscriber({ provider, normalizer, pricing: { "whisper-large-v3-turbo": { usdPerMinute: 0.6 } }, ...OPTIONS });

    const result = await transcriber.transcribe({ ...request, language: "en", prompt: "Names: Ola" });

    expect(result).toEqual({
      ok: true,
      value: {
        text: "Hi there.",
        language: "english",
        durationSeconds: 6,
        segments: [{ start: 0.2, end: 1.8, text: "Hi there." }],
        provider: "groq",
        model: "whisper-large-v3-turbo",
        billedSeconds: 6,
        costUsd: 0.06,
      },
    });
    expect(provider.chunks).toEqual([
      { bytes: new Uint8Array(100), fileName: "chunk-0.flac", mimeType: "audio/flac", timeoutMs: 120_000, language: "en", prompt: "Names: Ola" },
    ]);
    expect(normalizer.disposed).toBe(1);
  });

  it("sends long input in overlapping chunks and stitches the segments on one timeline", async () => {
    const provider = fakeProvider([
      { text: "a b", language: "english", segments: [{ start: 0, end: 5, text: "a" }, { start: 5, end: 10, text: "b" }] },
      { text: "c", language: null, segments: [{ start: 2, end: 8, text: "c" }] },
    ]);
    const transcriber = createTranscriber({ provider, normalizer: fakeNormalizer(16), ...OPTIONS });

    const result = await transcriber.transcribe(request);
    if (!result.ok) throw new Error(result.error);

    // Chunks 0–10 and 8–16, cut at 9: "b" (middle 7.5) stays, "c" lands at 10–16.
    expect(result.value.segments).toEqual([
      { start: 0, end: 5, text: "a" },
      { start: 5, end: 10, text: "b" },
      { start: 10, end: 16, text: "c" },
    ]);
    expect(result.value.text).toBe("a b c");
    expect(result.value.billedSeconds).toBe(18);
    expect(result.value.costUsd).toBeNull();
    expect(provider.chunks.map((chunk) => chunk.fileName)).toEqual(["chunk-0.flac", "chunk-1.flac"]);
  });

  it("falls back to the requested language when the provider reports none", async () => {
    const transcriber = createTranscriber({ provider: fakeProvider([{ text: "x", language: null, segments: [] }]), normalizer: fakeNormalizer(3) });

    const withLanguage = await transcriber.transcribe({ ...request, language: "pl" });
    const without = await transcriber.transcribe(request);

    expect(withLanguage.ok && withLanguage.value.language).toBe("pl");
    expect(without.ok && without.value.language).toBeNull();
    expect(without.ok && without.value.segments).toEqual([{ start: 0, end: 3, text: "x" }]);
  });

  it("reports one usage record per call with the seconds, cost, purpose and attributes", async () => {
    const records: SpeechUsageRecord[] = [];
    const clock = createTestClock(new Date("2026-11-02T10:00:00Z"));
    const provider: SpeechProvider = {
      ...fakeProvider([{ text: "x", language: null, segments: [] }]),
      transcribeChunk: () => {
        clock.advance(1_500);
        return Promise.resolve(ok({ text: "x", language: null, segments: [] }));
      },
    };
    const transcriber = createTranscriber({
      provider,
      normalizer: fakeNormalizer(16),
      pricing: { "whisper-large-v3-turbo": { usdPerMinute: 0.006 } },
      onUsage: (record) => {
        records.push(record);
      },
      clock,
      ...OPTIONS,
    });

    await transcriber.transcribe({ ...request, attributes: { accountId: "a-1" } });

    expect(records).toEqual([
      {
        provider: "groq",
        model: "whisper-large-v3-turbo",
        seconds: 18,
        costUsd: (18 / 60) * 0.006,
        outcome: "ok",
        purpose: "voice-note",
        durationMs: 3_000,
        at: new Date("2026-11-02T10:00:00Z"),
        attributes: { accountId: "a-1" },
      },
    ]);
  });

  it("stops at the first failed chunk, reports the seconds already sent, and returns the failure", async () => {
    const records: SpeechUsageRecord[] = [];
    const normalizer = fakeNormalizer(25);
    const provider = fakeProvider([
      { text: "a", language: null, segments: [] },
      { ok: false, error: "speech.rate_limited", retryAfterSeconds: 12 },
    ]);
    const transcriber = createTranscriber({ provider, normalizer, onUsage: (record) => void records.push(record), ...OPTIONS });

    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.rate_limited", retryAfterSeconds: 12 });
    expect(provider.chunks).toHaveLength(2);
    expect(records.map(({ seconds, outcome }) => ({ seconds, outcome }))).toEqual([{ seconds: 10, outcome: "speech.rate_limited" }]);
    expect(normalizer.disposed).toBe(1);
  });

  it("returns speech.aborted before normalizing when the signal is already aborted", async () => {
    const records: SpeechUsageRecord[] = [];
    let normalized = 0;
    const normalizer = fakeNormalizer(5);
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }]);
    const transcriber = createTranscriber({
      provider,
      normalizer: { normalize: (...args) => ((normalized += 1), normalizer.normalize(...args)) },
      onUsage: (record) => void records.push(record),
    });

    expect(await transcriber.transcribe({ ...request, signal: AbortSignal.abort() })).toEqual({ ok: false, error: "speech.aborted" });
    expect(normalized).toBe(0);
    expect(provider.chunks).toEqual([]);
    expect(records).toEqual([]);
  });

  it("returns speech.aborted after normalizing, before any upload, and removes the temporary files", async () => {
    const controller = new AbortController();
    const normalizer = fakeNormalizer(5);
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }]);
    const transcriber = createTranscriber({
      provider,
      normalizer: {
        normalize: async (...args) => {
          const result = await normalizer.normalize(...args);
          controller.abort();
          return result;
        },
      },
    });

    expect(await transcriber.transcribe({ ...request, signal: controller.signal })).toEqual({ ok: false, error: "speech.aborted" });
    expect(provider.chunks).toEqual([]);
    expect(normalizer.disposed).toBe(1);
  });

  it("stops between chunks when the signal aborts and reports the seconds already sent as speech.aborted", async () => {
    const records: SpeechUsageRecord[] = [];
    const controller = new AbortController();
    const normalizer = fakeNormalizer(25);
    const provider = fakeProvider([{ text: "a", language: null, segments: [] }]);
    const answer = (chunk: ProviderChunk) => provider.transcribeChunk(chunk);
    const transcriber = createTranscriber({
      provider: {
        ...provider,
        transcribeChunk: async (chunk) => {
          const result = await answer(chunk);
          controller.abort();
          return result;
        },
      },
      normalizer,
      onUsage: (record) => void records.push(record),
      ...OPTIONS,
    });

    expect(await transcriber.transcribe({ ...request, signal: controller.signal })).toEqual({ ok: false, error: "speech.aborted" });
    expect(provider.chunks).toHaveLength(1);
    expect(records.map(({ seconds, outcome }) => ({ seconds, outcome }))).toEqual([{ seconds: 10, outcome: "speech.aborted" }]);
    expect(normalizer.disposed).toBe(1);
  });

  it("passes the signal to each provider request and reports a failure during an abort as speech.aborted", async () => {
    const records: SpeechUsageRecord[] = [];
    const controller = new AbortController();
    const chunks: ProviderChunk[] = [];
    const provider: SpeechProvider = {
      ...fakeProvider([]),
      transcribeChunk: (chunk) => {
        chunks.push(chunk);
        controller.abort();
        return Promise.resolve({ ok: false, error: "speech.unavailable" });
      },
    };
    const transcriber = createTranscriber({ provider, normalizer: fakeNormalizer(5), onUsage: (record) => void records.push(record) });

    expect(await transcriber.transcribe({ ...request, signal: controller.signal })).toEqual({ ok: false, error: "speech.aborted" });
    expect(chunks.map((chunk) => chunk.signal)).toEqual([controller.signal]);
    expect(records).toEqual([]);
  });

  it("sends no signal to the provider when the request has none", async () => {
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }]);
    await createTranscriber({ provider, normalizer: fakeNormalizer(5) }).transcribe(request);

    expect(provider.chunks).toHaveLength(1);
    expect("signal" in provider.chunks[0]!).toBe(false);
  });

  it("reports no usage when nothing was transcribed", async () => {
    const records: SpeechUsageRecord[] = [];
    const transcriber = createTranscriber({
      provider: fakeProvider([{ ok: false, error: "speech.timeout" }]),
      normalizer: fakeNormalizer(5),
      onUsage: (record) => void records.push(record),
    });

    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.timeout" });
    expect(records).toEqual([]);
  });

  it("returns the normalizer's failures before sending anything", async () => {
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }]);
    const transcriber = createTranscriber({ provider, normalizer: fakeNormalizer(100), maxDurationSeconds: 60 });

    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.too_long" });
    expect(provider.chunks).toEqual([]);
  });

  it("refuses a chunk larger than the provider's upload limit as speech.too_long", async () => {
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }], 50);
    const normalizer = fakeNormalizer(5, 51);

    expect(await createTranscriber({ provider, normalizer }).transcribe(request)).toEqual({ ok: false, error: "speech.too_long" });
    expect(provider.chunks).toEqual([]);
    expect(normalizer.disposed).toBe(1);
  });

  it("removes the temporary files when the provider throws, and lets the throw through", async () => {
    const normalizer = fakeNormalizer(5);
    const provider: SpeechProvider = { ...fakeProvider([]), transcribeChunk: () => Promise.reject(new Error("bug")) };

    await expect(createTranscriber({ provider, normalizer }).transcribe(request)).rejects.toThrow("bug");
    expect(normalizer.disposed).toBe(1);
  });

  it("refuses invalid options and an empty purpose, naming them", async () => {
    const provider = fakeProvider([{ text: "x", language: null, segments: [] }]);
    expect(() => createTranscriber({ provider, timeoutMs: 0 })).toThrow("createTranscriber: timeoutMs must be a positive number");
    expect(() => createTranscriber({ provider, chunkSeconds: 10, overlapSeconds: 5 })).toThrow("overlapSeconds");
    expect(() => createTranscriber({ provider, pricing: { m: { usdPerMinute: -1 } } })).toThrow('pricing["m"]');
    await expect(createTranscriber({ provider, normalizer: fakeNormalizer(1) }).transcribe({ ...request, purpose: " " })).rejects.toThrow(
      "transcribe: purpose must not be empty",
    );
  });
});
