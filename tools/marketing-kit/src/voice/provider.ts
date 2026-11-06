import type { ProviderFailure } from "./provider-failure.js";
import type { TimedWord } from "./voiceover.js";

/** What a provider speaks: the text in one voice, model and language. */
export interface TtsInput {
  text: string;
  voiceId: string;
  model: string;
  /** ISO 639 code the voice speaks (`en`, `pl`). */
  language: string;
}

/** A finished recording: the audio file's bytes and the time of every spoken word. */
export interface TtsRecording {
  audio: Buffer;
  words: TimedWord[];
  /** What the provider says it charged, in the estimate's unit; null or absent when it does not say. */
  charged?: number | null;
}

/** What a recording would cost, shown before anything is spent. */
export interface TtsEstimate {
  /** Characters the provider bills for. */
  characters: number;
  /** Upper bound of the price in the provider's unit; a plan's discount can only lower it. */
  maxCost: number;
  unit: string;
}

/**
 * A provider's answer. A failure carries `error`, the sentence for logs, and, when the provider answered (or the kit
 * refused before asking), `providerFailure`: what an app logs and reads to decide whether to ask again (#1141).
 */
export type TtsResult<T> = { ok: true; value: T } | { ok: false; error: string; providerFailure?: ProviderFailure };

/**
 * A text-to-speech service. `estimate` is free and needs no credentials; `synthesize` may spend
 * money, so callers reach it only behind `--commit`.
 */
export interface TtsProvider {
  readonly id: string;
  estimate(input: TtsInput): TtsEstimate;
  synthesize(input: TtsInput): Promise<TtsResult<TtsRecording>>;
}

export const ok = <T>(value: T): TtsResult<T> => ({ ok: true, value });
export const err = <T>(error: string, providerFailure?: ProviderFailure): TtsResult<T> => (providerFailure === undefined ? { ok: false, error } : { ok: false, error, providerFailure });
