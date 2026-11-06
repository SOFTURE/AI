import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { err, ok } from "./failure.js";
import { probeAudio } from "./audio.js";
import { writeCacheFile } from "./cache.js";
import type { Edl } from "./edl.js";
import type { FootageFilm } from "./film.js";
import { getClipCacheKey } from "./paid.js";
import { getFfmpegReporting, type FootageResult, type FootageRunOptions, type PreparedClip } from "./pipeline.js";
import { runFfmpeg, withFfmpegFailureReporting } from "./process.js";
import { toPaidAudio, type IsolationProvider, type PaidAudio } from "./providers.js";
import {
  buildRangeAudioArgs,
  buildRangeLayArgs,
  getSpeechRangeCache,
  getSpeechRangeWindows,
  planSpeechRanges,
  DEFAULT_SPEECH_RANGE_FADE_MS,
  type LaidRange,
  type SpeechRange,
  type SpeechRangeCacheResolver,
} from "./speech-ranges.js";

/**
 * Voice isolation of only what the cut hears (issue #1087): each talking clip's sound ranges (`planSpeechRanges`) are
 * cleaned one by one and cached by the clip's identity, the range in milliseconds and the provider, so an unchanged
 * segment is never paid twice and a changed cut pays only its new ranges. The cleaned ranges are laid back over the
 * clip's own sound into one file as long as the clip: the speech map `renderFootage` takes. A range the provider refuses
 * is asked again, and one refused on every attempt keeps the clip's own sound in its window while the others are laid
 * (issue #1127): only a cancel stops the call.
 */

/** How often a refused range is asked again: `attempts` in all (default 3), waiting `delaysMs[n]` before attempt n + 2. */
export interface SpeechRangeRetry {
  /** Attempts per range, at least 1; default `DEFAULT_SPEECH_RANGE_ATTEMPTS` (3). */
  attempts?: number;
  /** Milliseconds before each retry (the last repeats); default `DEFAULT_SPEECH_RANGE_RETRY_DELAYS_MS` (1 s, 2 s). */
  delaysMs?: readonly number[];
  /** Waits `ms`, rejecting when `signal` aborts; default a timer. Injected by tests. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export const DEFAULT_SPEECH_RANGE_ATTEMPTS = 3;
export const DEFAULT_SPEECH_RANGE_RETRY_DELAYS_MS: readonly number[] = [1000, 2000];

export type IsolateSpeechRangesOptions = Pick<FootageRunOptions, "buildDir" | "cacheDir" | "providers" | "isCommit" | "signal" | "onCharge" | "onProgress" | "onFfmpegFailure"> & {
  /** Seconds added on each side of a sound span; default `DEFAULT_SPEECH_RANGE_MARGIN` (0.25). */
  margin?: number;
  /** Retries of a refused range. */
  retry?: SpeechRangeRetry;
  /** Milliseconds of the linear crossfade at every join; default `DEFAULT_SPEECH_RANGE_FADE_MS` (15), 0 switches at once. */
  fadeMs?: number;
  /** The `item` of a range's charge (e.g. the app's segment id); default the clip id. */
  chargeItem?: (range: SpeechRange) => string;
  /**
   * Where a range's cleaned voice is cached; default `getSpeechRangeCache` (`<cacheDir>/<film>/<key>.isolated.mp3`).
   * An app that already holds paid ranges under its own keys points the block at them.
   */
  rangeCache?: SpeechRangeCacheResolver;
  log?: (line: string) => void;
};

/** What happened to a range in this call. */
export type SpeechRangeOutcome =
  | { kind: "cached" }
  | { kind: "bought"; attempts: number }
  | { kind: "failed"; error: string; attempts: number }
  | { kind: "not_bought" };

export interface IsolatedSpeechRange extends SpeechRange {
  /** The paid cache's key and file of the range's cleaned voice. */
  cacheKey: string;
  path: string;
  /** Whether the cleaned voice was in the cache before this call. */
  cached: boolean;
  /** Whether it is laid in the clip's speech file (cached, or bought with `isCommit`). */
  laid: boolean;
  /**
   * `cached`; `bought` in this call; `failed` when the provider refused it on every attempt (its window keeps the
   * clip's own sound); `not_bought` without `isCommit`.
   */
  outcome: SpeechRangeOutcome;
}

export interface IsolatedSpeech {
  /** Every clip's audio for the speech track: its laid file, or the normalized clip when none of its ranges is laid. */
  speech: Record<string, string>;
  ranges: IsolatedSpeechRange[];
}

/**
 * Cleans the voice of the ranges the cut hears and answers the speech map the render takes (`TranscribeOutcome.speech`).
 * With `isCommit` every uncached range is bought (`onCharge` step `isolate`, item the clip id, with its `range`);
 * without it only cached ranges are laid, a free draft, and `ranges` names what is still missing. A refused range is
 * retried (`retry`); one refused on every attempt is answered `failed` and the call still succeeds. Each clip with a
 * laid range gets `<buildDir>/audio/<id>.ranges.mp3`, crossfaded at every join (`fadeMs`).
 */
export function isolateSpeechRanges(film: FootageFilm, clips: PreparedClip[], edl: Edl, options: IsolateSpeechRangesOptions): Promise<FootageResult<IsolatedSpeech>> {
  const log = options.log ?? ((): void => undefined);
  return withFfmpegFailureReporting(getFfmpegReporting({ log, ...(options.onFfmpegFailure === undefined ? {} : { onFfmpegFailure: options.onFfmpegFailure }) }), () =>
    runIsolateSpeechRanges(film, clips, edl, options, log),
  );
}

/** The body of `isolateSpeechRanges`, inside its ffmpeg failure reporting. */
async function runIsolateSpeechRanges(
  film: FootageFilm,
  clips: PreparedClip[],
  edl: Edl,
  options: IsolateSpeechRangesOptions,
  log: (line: string) => void,
): Promise<FootageResult<IsolatedSpeech>> {
  const { buildDir, providers, signal } = options;
  const aborting = signal === undefined ? {} : { signal };
  const planned = planSpeechRanges(
    edl,
    clips.map((clip) => ({ id: clip.clip.id, role: clip.clip.role, duration: clip.duration })),
    options.margin === undefined ? {} : { margin: options.margin },
  );
  const byClip = new Map(clips.map((clip) => [clip.clip.id, clip]));
  const clipKeys = new Map<string, string>();
  const ranges: IsolatedSpeechRange[] = [];
  for (const range of planned) {
    const clip = byClip.get(range.clip);
    if (clip === undefined) continue;
    let clipKey = clipKeys.get(range.clip);
    if (clipKey === undefined) {
      clipKey = await getClipCacheKey(clip.source, clip.clip);
      clipKeys.set(range.clip, clipKey);
    }
    const cache = options.rangeCache?.(range, clipKey) ?? getSpeechRangeCache(film.id, clipKey, range, { cacheDir: options.cacheDir, provider: providers.isolation.id });
    const cached = existsSync(cache.path);
    ranges.push({ ...range, cacheKey: cache.key, path: cache.path, cached, laid: cached, outcome: cached ? { kind: "cached" } : { kind: "not_bought" } });
  }
  const buying = options.isCommit ? ranges.filter((range) => !range.cached) : [];
  const total = buying.reduce((sum, range) => sum + (range.endMs - range.startMs) / 1000, 0);
  let done = 0;
  const report = (range: SpeechRange, index: number): void => {
    options.onProgress?.({ step: "isolate", item: range.clip, itemIndex: index + 1, itemCount: buying.length, done: Math.round(done * 1000) / 1000, total: Math.round(total * 1000) / 1000 });
  };
  const workDir = join(buildDir, "audio", "ranges");
  for (const [index, range] of buying.entries()) {
    const clip = byClip.get(range.clip);
    if (clip === undefined) continue;
    const units = (range.endMs - range.startMs) / 1000;
    report(range, index);
    mkdirSync(workDir, { recursive: true });
    // The provider sees the clip's id and the range as the file name.
    const input = join(workDir, `${range.clip}.${String(range.startMs)}-${String(range.endMs)}.mp3`);
    await runFfmpeg(`Cutting ${describeRange(range)} for voice isolation`, buildRangeAudioArgs(clip.file, range, input), { ...aborting, output: input });
    signal?.throwIfAborted();
    log(`voice isolation (${providers.isolation.id}): ${describeRange(range)}, ${units.toFixed(1)} s.`);
    const answer = await isolateWithRetries({
      audio: input,
      isolation: providers.isolation,
      retry: options.retry ?? {},
      ...aborting,
      onRefused: (error, attempt) => {
        log(`voice isolation: ${describeRange(range)} refused (attempt ${String(attempt)}): ${error}`);
      },
    });
    if (!answer.ok) {
      range.outcome = { kind: "failed", error: answer.error, attempts: answer.attempts };
      done += units;
      report(range, index);
      continue;
    }
    const paid = answer.paid;
    writeCacheFile(range.path, paid.audio);
    range.laid = true;
    range.outcome = { kind: "bought", attempts: answer.attempts };
    options.onCharge?.({
      step: "isolate",
      item: options.chargeItem?.(range) ?? range.clip,
      provider: providers.isolation.id,
      units,
      ...(paid.credits === undefined ? {} : { credits: paid.credits }),
      cacheKey: range.cacheKey,
      range: { start: range.startMs / 1000, end: range.endMs / 1000 },
    });
    log(`voice isolation: saved ${range.path} (commit it).`);
    done += units;
    report(range, index);
  }
  const failed = ranges.filter((range) => range.outcome.kind === "failed");
  if (failed.length > 0) log(`voice isolation: ${String(failed.length)} range${failed.length === 1 ? "" : "s"} refused, laid with the clip's own sound: ${failed.map(describeRange).join("; ")}.`);
  const missing = ranges.filter((range) => range.outcome.kind === "not_bought");
  if (missing.length > 0) {
    const seconds = missing.reduce((sum, range) => sum + (range.endMs - range.startMs) / 1000, 0);
    log(`voice isolation DRY RUN: ${String(missing.length)} range${missing.length === 1 ? "" : "s"} (${seconds.toFixed(1)} s) not cached, laid with the clip's own sound. Run with --commit to pay.`);
  }
  const speech: Record<string, string> = {};
  for (const clip of clips) {
    const id = clip.clip.id;
    speech[id] = clip.file;
    const laidRanges = ranges.filter((range) => range.clip === id && range.laid);
    if (laidRanges.length === 0) continue;
    const laid: LaidRange[] = [];
    for (const window of getSpeechRangeWindows(laidRanges)) {
      const file = laidRanges.find((range) => range === window.range)?.path;
      if (file === undefined) continue;
      const probed = await probeAudio(file, aborting);
      if (!probed.ok) return err(`${describeRange(window.range)}: the cleaned voice at ${file} does not read (${probed.error}); delete it and run again.`);
      laid.push({ window, file, isMono: probed.probe.channels === 1 });
    }
    const output = join(buildDir, "audio", `${id}.ranges.mp3`);
    mkdirSync(join(buildDir, "audio"), { recursive: true });
    await runFfmpeg(`Laying the cleaned voice over clip ${id}`, buildRangeLayArgs(clip.file, laid, output, { fadeMs: options.fadeMs ?? DEFAULT_SPEECH_RANGE_FADE_MS }), { ...aborting, output });
    speech[id] = output;
  }
  return ok({ speech, ranges });
}

type IsolationAnswer = { ok: true; paid: PaidAudio; attempts: number } | { ok: false; error: string; attempts: number };

/** Asks the provider for one range's cleaned voice, again after each refusal up to `retry.attempts`; a cancel throws. */
async function isolateWithRetries(input: {
  audio: string;
  isolation: IsolationProvider;
  retry: SpeechRangeRetry;
  signal?: AbortSignal;
  onRefused: (error: string, attempt: number) => void;
}): Promise<IsolationAnswer> {
  const { audio, isolation, retry, signal, onRefused } = input;
  const attempts = Math.max(1, Math.floor(retry.attempts ?? DEFAULT_SPEECH_RANGE_ATTEMPTS));
  const delays = retry.delaysMs ?? DEFAULT_SPEECH_RANGE_RETRY_DELAYS_MS;
  const wait = retry.wait ?? waitFor;
  let error = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      await wait(delays[Math.min(attempt - 2, delays.length - 1)] ?? 0, signal);
      signal?.throwIfAborted();
    }
    const cleaned = await isolation.isolate({ audio, ...(signal === undefined ? {} : { signal }) });
    signal?.throwIfAborted();
    if (cleaned.ok) return { ok: true, paid: toPaidAudio(cleaned.value), attempts: attempt };
    error = cleaned.error;
    onRefused(error, attempt);
  }
  return { ok: false, error, attempts };
}

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
async function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  try {
    await sleep(ms, undefined, signal === undefined ? {} : { signal });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
}

function describeRange(range: SpeechRange): string {
  return `clip ${range.clip} ${(range.startMs / 1000).toFixed(3)}-${(range.endMs / 1000).toFixed(3)} s`;
}
