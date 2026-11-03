// Test double for code that calls @softure-ai/speech: a transcriber that answers from a script.
import { ok, type Ok } from "@softure-ai/core";
import type { SpeechErrorCode, SpeechFailure, Transcript, TranscriptSegment } from "../contract.js";
import type { TranscribeRequest, Transcriber } from "../create-transcriber.js";

const DEFAULT_PROVIDER = "fake";
const DEFAULT_MODEL = "fake-whisper";
const DEFAULT_TEXT = "Fake transcript.";
const DEFAULT_DURATION_SECONDS = 2;

/** One scripted answer. */
export type FakeTranscription =
  /**
   * A transcript. Without `segments`, one segment spans `durationSeconds` (default 2) with `text` (default
   * "Fake transcript."); with them, `text` defaults to their texts joined.
   */
  | {
      readonly kind: "transcript";
      readonly text?: string;
      readonly segments?: readonly TranscriptSegment[];
      readonly language?: string | null;
      readonly durationSeconds?: number;
      readonly costUsd?: number | null;
    }
  /** A failure with its code; `retryAfterSeconds` (default `null`) only for `speech.rate_limited`. */
  | { readonly kind: "failure"; readonly code: SpeechErrorCode; readonly retryAfterSeconds?: number | null };

export interface FakeTranscriber extends Transcriber {
  /** Every request received, in order. */
  readonly calls: readonly TranscribeRequest[];
}

/**
 * A transcriber that answers call N with `responses[N]`; the last response repeats. Without responses every call gets
 * the default transcript. `fakeTranscriber({ kind: "failure", code: "speech.rate_limited", retryAfterSeconds: 30 })`.
 */
export function fakeTranscriber(...responses: FakeTranscription[]): FakeTranscriber {
  const calls: TranscribeRequest[] = [];

  function transcribe(request: TranscribeRequest): Promise<Ok<Transcript> | SpeechFailure> {
    const response: FakeTranscription = responses[Math.min(calls.length, responses.length - 1)] ?? { kind: "transcript" };
    calls.push(request);
    return Promise.resolve(answer(response, request));
  }

  return { calls, transcribe };
}

function answer(response: FakeTranscription, request: TranscribeRequest): Ok<Transcript> | SpeechFailure {
  if (response.kind === "failure") {
    if (response.code === "speech.rate_limited") {
      return { ok: false, error: response.code, retryAfterSeconds: response.retryAfterSeconds ?? null };
    }
    return { ok: false, error: response.code };
  }
  const durationSeconds = response.durationSeconds ?? response.segments?.at(-1)?.end ?? DEFAULT_DURATION_SECONDS;
  const segments = response.segments ?? [{ start: 0, end: durationSeconds, text: response.text ?? DEFAULT_TEXT }];
  return ok({
    text: response.text ?? segments.map((segment) => segment.text).join(" "),
    language: response.language === undefined ? (request.language ?? null) : response.language,
    durationSeconds,
    segments,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    billedSeconds: durationSeconds,
    costUsd: response.costUsd ?? null,
  });
}
