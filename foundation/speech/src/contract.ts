// Error codes and the shapes an app reads back from @softure-ai/speech. No copy: the app translates codes itself.
import type { Err } from "@softure-ai/core";

/** Every expected failure of a transcription, as a stable code. */
export const SPEECH_ERROR_CODES = [
  "speech.too_long",
  "speech.unsupported_format",
  "speech.provider_refused",
  "speech.rate_limited",
  "speech.timeout",
  "speech.unavailable",
] as const;

/**
 * - `speech.too_long`: the audio is longer than `maxDurationSeconds`, or the provider refused a chunk as too large;
 * - `speech.unsupported_format`: ffmpeg (or the provider) could not decode the input as audio;
 * - `speech.provider_refused`: the provider refused the request (a wrong key, a model it does not serve);
 * - `speech.rate_limited`: the provider asked to slow down; `retryAfterSeconds` says when to try again, when it said;
 * - `speech.timeout`: a provider request ran past `timeoutMs`;
 * - `speech.unavailable`: the provider failed (network, HTTP 5xx, an answer that could not be read, a missing key).
 */
export type SpeechErrorCode = (typeof SPEECH_ERROR_CODES)[number];

/** A failed transcription: the code, and for `speech.rate_limited` when to try again. */
export type SpeechFailure =
  | Err<Exclude<SpeechErrorCode, "speech.rate_limited">>
  | (Err<"speech.rate_limited"> & {
      /** From the provider's `Retry-After`; `null` when it sent none. */
      readonly retryAfterSeconds: number | null;
    });

/** One stretch of speech, in seconds from the start of the input. */
export interface TranscriptSegment {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** The value of a successful `transcribe`. */
export interface Transcript {
  /** The segments' texts joined with single spaces (the provider's text when it returned no segments). */
  readonly text: string;
  /** The language the provider detected (or was told), as it reported it; `null` when neither is known. */
  readonly language: string | null;
  /** The length of the normalized audio. */
  readonly durationSeconds: number;
  readonly segments: readonly TranscriptSegment[];
  readonly provider: string;
  readonly model: string;
  /** Seconds of audio sent to the provider, chunk overlaps included: what the provider bills. */
  readonly billedSeconds: number;
  /** From the app's `pricing`; `null` when the model has no price. */
  readonly costUsd: number | null;
}

/** The price of one model, in USD per minute of audio. */
export interface SpeechPrice {
  readonly usdPerMinute: number;
}

/** Model id → price. */
export type SpeechPricing = Readonly<Record<string, SpeechPrice>>;

/** What `onUsage` receives after every call that sent audio to the provider, failures included. */
export interface SpeechUsageRecord {
  readonly provider: string;
  readonly model: string;
  /** Seconds of audio the provider transcribed in this call (the chunks it answered, overlaps included). */
  readonly seconds: number;
  readonly costUsd: number | null;
  readonly outcome: "ok" | SpeechErrorCode;
  /** The call's `purpose`, e.g. `"voice-note"`. */
  readonly purpose: string;
  /** From the start of the call to its end, normalization included. */
  readonly durationMs: number;
  readonly at: Date;
  /** The call's `attributes`, e.g. `{ accountId }`. */
  readonly attributes: Readonly<Record<string, string>>;
}

/** The `onUsage` hook. */
export type SpeechUsageHook = (record: SpeechUsageRecord) => void | Promise<void>;
