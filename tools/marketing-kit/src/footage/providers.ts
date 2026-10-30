import type { TtsResult } from "../voice/provider.js";
import type { TimedWord } from "../voice/voiceover.js";

/**
 * The paid services of a footage film, each behind an interface so tests and rehearsals use fakes. Every call may
 * spend money, so the pipeline reaches them only with `isCommit`; before that it prints `PaidStep` estimates.
 */

export interface SttInput {
  /** A local audio (or video) file. */
  audio: string;
  /** ISO 639 code the speech is in. */
  language: string;
  /** Aborts the request. */
  signal?: AbortSignal;
}

export interface SttTranscript {
  /** Spoken words with their times in seconds from the file's start; no spacing or sound events. */
  words: TimedWord[];
  language: string;
  /** What the provider reported it charged for the call, in its credits; absent when the API reports nothing. */
  credits?: number;
}

/** Audio a paid call returned, with the charge the provider reported (absent when the API reports nothing). */
export interface PaidAudio {
  audio: Buffer;
  credits?: number;
}

/** Speech to text with a time for every word. */
export interface SttProvider {
  readonly id: string;
  /** Part of the cache key: another model is another transcript. */
  readonly model: string;
  transcribe(input: SttInput): Promise<TtsResult<SttTranscript>>;
}

/** Removes background noise from speech; returns the cleaned audio (mp3), alone or with the reported charge. */
export interface IsolationProvider {
  readonly id: string;
  isolate(input: { audio: string; signal?: AbortSignal }): Promise<TtsResult<Buffer | PaidAudio>>;
}

/** Generates music (mp3): from a prompt at a length, or scored to a video. */
export interface MusicProvider {
  readonly id: string;
  readonly model: string;
  compose(input: { prompt: string; seconds: number; signal?: AbortSignal }): Promise<TtsResult<Buffer | PaidAudio>>;
  scoreVideo(input: { video: string; description: string; tags: string[]; signal?: AbortSignal }): Promise<TtsResult<Buffer | PaidAudio>>;
}

/** A provider's audio answer as `PaidAudio`, whichever of the two shapes it returned. */
export function toPaidAudio(value: Buffer | PaidAudio): PaidAudio {
  return Buffer.isBuffer(value) ? { audio: value } : value;
}

export interface FootageProviders {
  stt: SttProvider;
  isolation: IsolationProvider;
  music: MusicProvider;
}

export type PaidStepKind = "transcribe" | "isolate" | "music";

/** One paid call the film needs, as the dry run shows it. The services bill by length, so the estimate is seconds. */
export interface PaidStep {
  kind: PaidStepKind;
  /** What it is for: a clip id, or `film`. */
  item: string;
  provider: string;
  seconds: number;
}

const STEP_LABELS: Record<PaidStepKind, string> = {
  transcribe: "speech to text",
  isolate: "voice isolation",
  music: "music",
};

/** The dry run's report: one line per paid call and the total length billed. */
export function describePaidSteps(steps: PaidStep[]): string[] {
  const lines = steps.map((step) => `${STEP_LABELS[step.kind]} (${step.provider}) for ${step.item}: ${step.seconds.toFixed(1)} s`);
  const total = steps.reduce((sum, step) => sum + step.seconds, 0);
  lines.push(`footage estimate: ${steps.length} paid call${steps.length === 1 ? "" : "s"}, ${total.toFixed(1)} s of audio or music billed by the providers' per-minute rates.`);
  return lines;
}

/** Credits per second billed, for each paid step; the caller's prices (the kit hard-codes none). */
export type FootageRates = Record<PaidStepKind, number>;

/** One paid call made, as `onCharge` reports it: what for, how much was billed and where its result is cached. */
export interface FootageCharge {
  step: PaidStepKind;
  /** A clip id, or `film` for the music. */
  item: string;
  provider: string;
  /** Seconds of audio or music billed. */
  units: number;
  /** The provider's reported charge, when its API returns one. */
  credits?: number;
  /** The paid cache's key of the result (the file name's first part under `<cacheDir>/<film id>/`). */
  cacheKey: string;
}

/** A stage of a footage run that reports progress. */
export type FootageStage = "normalize" | PaidStepKind | "assets" | "render" | "finish";

/**
 * Progress of a footage run. `done` and `total` are seconds of media across the whole stage (a bar per stage);
 * `itemIndex` of `itemCount` (from 1) names the clip or asset being worked on ("normalizing clip 2 of 4").
 */
export interface FootageProgress {
  step: FootageStage;
  item: string;
  itemIndex: number;
  itemCount: number;
  done: number;
  total: number;
}
