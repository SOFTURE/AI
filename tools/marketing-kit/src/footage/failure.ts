import type { ProviderFailure } from "../voice/provider-failure.js";
import type { MixLoudness } from "./loudness.js";

/**
 * Why a footage step failed, for an app to act on without reading `error` (issue #1126):
 * - `loudness`: the film's mix or the finished film misses `mixLoudness` (the last measurement; null when the mix
 *   measures silent after its gain and limiter). The same inputs fail the same way: no retry.
 * - `publishable`: the finished file fails the container, codec profile or fast start checks (the problems).
 * - `input`: the film, its EDL, fonts, files or settings cannot be used as given. A retry fails the same way.
 * - `provider`: a paid provider (speech to text, voice isolation, music) failed with the structured details it gave
 *   (issue #1141); a retry may succeed only when `provider.isRetryable`.
 * - `process`: anything else (a process that exited, the network, the disk). A retry may succeed.
 * A failed ffmpeg step still throws and an abort still rejects with the signal's reason; neither is a result.
 */
export type FootageFailure =
  | { kind: "loudness"; loudness: MixLoudness | null }
  | { kind: "publishable"; problems: string[] }
  | { kind: "input" }
  | { kind: "provider"; provider: ProviderFailure }
  | { kind: "process" };

export type FootageFailureKind = FootageFailure["kind"];

/** A footage failure: `error` is the sentence for logs, `failure` what the app reads. */
export interface FootageError {
  ok: false;
  error: string;
  failure: FootageFailure;
}

export type FootageResult<T> = { ok: true; value: T } | FootageError;

/** A footage success. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

const PROCESS_FAILURE: FootageFailure = { kind: "process" };

/** A footage failure with its sentence; without a `failure`, the transient `process` kind. */
export function err(error: string, failure: FootageFailure = PROCESS_FAILURE): FootageError {
  return { ok: false, error, failure };
}

/** A provider's failure as a footage failure: `provider` with its details, or `process` when it gave none. */
export function getProviderFootageFailure(providerFailure: ProviderFailure | undefined): FootageFailure {
  return providerFailure === undefined ? PROCESS_FAILURE : { kind: "provider", provider: providerFailure };
}

/**
 * True when running the same step again may succeed: `process`, or `provider` with `isRetryable`; a gate miss, a bad
 * input or a provider's refusal fails again.
 */
export function isRetryableFootageFailure(failure: FootageFailure): boolean {
  if (failure.kind === "provider") return failure.provider.isRetryable;
  return failure.kind === "process";
}
