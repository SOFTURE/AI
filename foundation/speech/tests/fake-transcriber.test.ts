import { describe, expect, it } from "vitest";
import { fakeTranscriber } from "../src/testing/index.js";

const request = { input: { kind: "file" as const, path: "a.mp3" }, purpose: "test" };

describe("fakeTranscriber", () => {
  it("answers with a default transcript and records the calls", async () => {
    const transcriber = fakeTranscriber();

    const result = await transcriber.transcribe({ ...request, language: "en" });

    expect(result).toEqual({
      ok: true,
      value: {
        text: "Fake transcript.",
        language: "en",
        durationSeconds: 2,
        segments: [{ start: 0, end: 2, text: "Fake transcript." }],
        provider: "fake",
        model: "fake-whisper",
        billedSeconds: 2,
        costUsd: null,
      },
    });
    expect(transcriber.calls).toEqual([{ ...request, language: "en" }]);
  });

  it("answers from the script in order and repeats the last answer", async () => {
    const transcriber = fakeTranscriber(
      { kind: "transcript", segments: [{ start: 0, end: 4, text: "One." }, { start: 4, end: 7, text: "Two." }], language: "english", costUsd: 0.01 },
      { kind: "failure", code: "speech.rate_limited", retryAfterSeconds: 30 },
      { kind: "failure", code: "speech.unsupported_format" },
    );

    const first = await transcriber.transcribe(request);
    expect(first.ok && first.value).toMatchObject({ text: "One. Two.", durationSeconds: 7, language: "english", costUsd: 0.01 });
    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.rate_limited", retryAfterSeconds: 30 });
    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.unsupported_format" });
    expect(await transcriber.transcribe(request)).toEqual({ ok: false, error: "speech.unsupported_format" });
    expect(transcriber.calls).toHaveLength(4);
  });
});
