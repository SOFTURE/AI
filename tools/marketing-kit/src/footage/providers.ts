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
}

export interface SttTranscript {
  /** Spoken words with their times in seconds from the file's start; no spacing or sound events. */
  words: TimedWord[];
  language: string;
}

/** Speech to text with a time for every word. */
export interface SttProvider {
  readonly id: string;
  /** Part of the cache key: another model is another transcript. */
  readonly model: string;
  transcribe(input: SttInput): Promise<TtsResult<SttTranscript>>;
}

/** Removes background noise from speech; returns the cleaned audio (mp3). */
export interface IsolationProvider {
  readonly id: string;
  isolate(input: { audio: string }): Promise<TtsResult<Buffer>>;
}

/** Generates music (mp3): from a prompt at a length, or scored to a video. */
export interface MusicProvider {
  readonly id: string;
  readonly model: string;
  compose(input: { prompt: string; seconds: number }): Promise<TtsResult<Buffer>>;
  scoreVideo(input: { video: string; description: string; tags: string[] }): Promise<TtsResult<Buffer>>;
}

export interface FootageProviders {
  stt: SttProvider;
  isolation: IsolationProvider;
  music: MusicProvider;
}

/** One paid call the film needs, as the dry run shows it. The services bill by length, so the estimate is seconds. */
export interface PaidStep {
  kind: "transcribe" | "isolate" | "music";
  /** What it is for: a clip id, or `film`. */
  item: string;
  provider: string;
  seconds: number;
}

const STEP_LABELS: Record<PaidStep["kind"], string> = {
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
