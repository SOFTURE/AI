import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { describeProviderFailure, type ProviderFailure } from "../voice/provider-failure.js";
import { err, ok } from "./failure.js";
import { probeAudio } from "./audio.js";
import { prepareClipSounds, type ClipSound, type SpeechPeaks, type SpeechPreGain } from "./clip-sound.js";
import { isSilent, readLoudnessMeasurement } from "./loudness.js";
import { writeCacheFile } from "./cache.js";
import type { Edl } from "./edl.js";
import type { FootageFilm } from "./film.js";
import { getClipCacheKey } from "./paid.js";
import { getFfmpegReporting, type FootageResult, type FootageRunOptions, type PreparedClip } from "./pipeline.js";
import { runFfmpeg, runProcess, withFfmpegFailureReporting } from "./process.js";
import { toPaidAudio, type IsolationProvider, type PaidAudio } from "./providers.js";
import {
  buildRangeAudioArgs,
  buildRangeLayArgs,
  buildRangeMeasureArgs,
  formatSpeechRangeGain,
  getPlanOptions,
  getRangeInputGainDb,
  getSpeechRangeGainPath,
  getSpeechRangeCache,
  getSpeechRangeWindows,
  planSpeechRanges,
  readSpeechRangeGain,
  DEFAULT_SPEECH_RANGE_FADE_MS,
  type LaidRange,
  type PlanSpeechRangesOptions,
  type SpeechRange,
  type SpeechRangeCacheResolver,
} from "./speech-ranges.js";

/**
 * Voice isolation of only what the cut hears (issue #1087): each talking clip's sound ranges (`planSpeechRanges`) are
 * cleaned one by one and cached by the clip's identity, the range in milliseconds and the provider, so an unchanged
 * segment is never paid twice and a changed cut pays only its new ranges. The cleaned ranges are laid back over the
 * clip's own sound into one file as long as the clip: the speech map `renderFootage` takes. A range the provider refuses
 * is asked again, and one refused on every attempt keeps the clip's own sound in its window while the others are laid
 * (issue #1127): only a cancel stops the call. The ranges reach the provider's minimum input (`minSeconds`, issue
 * #1140): near ranges of a clip are merged, a short one is widened with the clip's own context and only the part the
 * cut hears is laid; a range that still cannot pass is never sent. A refusal the provider marks not retryable
 * (`isRetryable: false`, e.g. a 400 `audio_too_short`) is not asked again (issue #1141). Every window lands at the
 * level of the clip's pre-gained sound (issue #1159): a bought range records the gain it was cut at next to its cached
 * file, and a cached range cut from the un-gained sound (bought before the pre-gain) is raised by the clip's pre-gain.
 */

/**
 * How often a refused range is asked again: `attempts` in all (default 3), waiting `delaysMs[n]` before attempt n + 2.
 * A failure whose `providerFailure.isRetryable` is false ends the range at once.
 */
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
  /** Ranges of a clip at most this many seconds apart are isolated as one; default 2, `null` keeps them apart. */
  mergeGap?: PlanSpeechRangesOptions["mergeGap"];
  /** Seconds a range shorter than the provider's minimum is widened past it; default `DEFAULT_SPEECH_RANGE_MIN_PAD` (0.4). */
  minPad?: number;
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
  /** How the clip sound's pre-gain treats a true peak above the ceiling (`SpeechPeaks`, issue #1181); default `ceiling`. */
  speechPeaks?: SpeechPeaks;
  log?: (line: string) => void;
};

/** What happened to a range in this call. */
export type SpeechRangeOutcome =
  | { kind: "cached" }
  | { kind: "bought"; attempts: number }
  | {
      kind: "failed";
      error: string;
      attempts: number;
      /** The provider's structured failure of the last attempt (safe to log); null when it gave none. */
      providerFailure: ProviderFailure | null;
    }
  | { kind: "skipped"; reason: "too_short"; minSeconds: number }
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
   * clip's own sound); `skipped` when it is shorter than the provider's minimum even after merging and widening (never
   * sent, its window keeps the clip's own sound); `not_bought` without `isCommit`.
   */
  outcome: SpeechRangeOutcome;
  /**
   * The dB its cleaned voice was raised by when laid (issue #1159): the clip's pre-gain for a range cut from the
   * clip's un-gained sound, else 0; 0 when it is not laid.
   */
  gainDb: number;
}

export interface IsolatedSpeech {
  /** Every clip's audio for the speech track: its laid file, or its lossless sound when none of its ranges is laid. */
  speech: Record<string, string>;
  /** Each clip's pre-gain in dB (`prepareClipSounds`): the gain of the sound its speech file is made from (issue #1159). */
  speechGainDb: Record<string, number>;
  /** What each clip's pre-gain reached (`ClipSound.preGain`, issue #1181): on target, or held by the peak ceiling. */
  speechPreGain: Record<string, SpeechPreGain>;
  ranges: IsolatedSpeechRange[];
}

/**
 * Cleans the voice of the ranges the cut hears and answers the speech map the render takes (`TranscribeOutcome.speech`).
 * With `isCommit` every uncached range is bought (`onCharge` step `isolate`, item the clip id, with its `range`);
 * without it only cached ranges are laid, a free draft, and `ranges` names what is still missing. A refused range is
 * retried (`retry`); one refused on every attempt is answered `failed` and the call still succeeds. Each clip with a
 * laid range gets `<buildDir>/audio/<id>.ranges.wav`, crossfaded at every join (`fadeMs`). The isolator hears, and the
 * ranges are laid over, each clip's lossless, pre-gained sound (`prepareClipSounds`, issue #1139).
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
    getPlanOptions(options, providers.isolation),
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
    if (range.skip !== undefined) {
      ranges.push({ ...range, cacheKey: cache.key, path: cache.path, cached: false, laid: false, outcome: { kind: "skipped", ...range.skip }, gainDb: 0 });
      continue;
    }
    const cached = existsSync(cache.path);
    ranges.push({ ...range, cacheKey: cache.key, path: cache.path, cached, laid: cached, outcome: cached ? { kind: "cached" } : { kind: "not_bought" }, gainDb: 0 });
  }
  const skipped = ranges.filter((range) => range.outcome.kind === "skipped");
  if (skipped.length > 0) {
    const minimum = providers.isolation.minSeconds ?? 0;
    log(`voice isolation: ${String(skipped.length)} range${skipped.length === 1 ? "" : "s"} shorter than ${providers.isolation.id}'s minimum of ${String(minimum)} s even with the clip's whole sound, not sent, laid with the clip's own sound: ${skipped.map(describeRange).join("; ")}.`);
  }
  const buying = options.isCommit ? ranges.filter((range) => range.outcome.kind === "not_bought") : [];
  const total = buying.reduce((sum, range) => sum + (range.endMs - range.startMs) / 1000, 0);
  let done = 0;
  const report = (range: SpeechRange, index: number): void => {
    options.onProgress?.({ step: "isolate", item: range.clip, itemIndex: index + 1, itemCount: buying.length, done: Math.round(done * 1000) / 1000, total: Math.round(total * 1000) / 1000 });
  };
  // Every clip's sound, lossless and pre-gained (#1139): what the isolator hears and what the cleaned ranges are laid over.
  const sounds = await prepareClipSounds(clips, { buildDir, log, ...aborting, ...(options.speechPeaks === undefined ? {} : { peaks: options.speechPeaks }) });
  const getSound = (clip: PreparedClip): string => sounds[clip.clip.id]?.file ?? clip.file;
  const workDir = join(buildDir, "audio", "ranges");
  for (const [index, range] of buying.entries()) {
    const clip = byClip.get(range.clip);
    if (clip === undefined) continue;
    const units = (range.endMs - range.startMs) / 1000;
    report(range, index);
    mkdirSync(workDir, { recursive: true });
    // The provider sees the clip's id and the range as the file name.
    const input = join(workDir, `${range.clip}.${String(range.startMs)}-${String(range.endMs)}.wav`);
    await runFfmpeg(`Cutting ${describeRange(range)} for voice isolation`, buildRangeAudioArgs(getSound(clip), range, input, options.speechPeaks === undefined ? {} : { peaks: options.speechPeaks }), { ...aborting, output: input });
    signal?.throwIfAborted();
    log(`voice isolation (${providers.isolation.id}): ${describeRange(range)}, ${units.toFixed(1)} s.`);
    const answer = await isolateWithRetries({
      audio: input,
      isolation: providers.isolation,
      retry: options.retry ?? {},
      ...aborting,
      onRefused: (error, attempt, providerFailure) => {
        const reason = providerFailure === null ? error : describeProviderFailure(providerFailure);
        log(`voice isolation: ${describeRange(range)} refused (attempt ${String(attempt)}): ${reason}`);
      },
    });
    if (!answer.ok) {
      rmSync(input, { force: true });
      range.outcome = { kind: "failed", error: answer.error, attempts: answer.attempts, providerFailure: answer.providerFailure };
      done += units;
      report(range, index);
      continue;
    }
    const paid = answer.paid;
    writeCacheFile(range.path, paid.audio);
    // The gain of the sound it was cut from, so a later call lays it at the level of the clip's sound then (#1159).
    writeCacheFile(getSpeechRangeGainPath(range.path), formatSpeechRangeGain(sounds[clip.clip.id]?.gainDb ?? 0));
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
  const speechGainDb: Record<string, number> = {};
  const speechPreGain: Record<string, SpeechPreGain> = {};
  for (const clip of clips) {
    const id = clip.clip.id;
    speech[id] = getSound(clip);
    const clipGainDb = sounds[id]?.gainDb ?? 0;
    speechGainDb[id] = clipGainDb;
    speechPreGain[id] = sounds[id]?.preGain ?? { kind: "silent" };
    const laidRanges = ranges.filter((range) => range.clip === id && range.laid);
    if (laidRanges.length === 0) continue;
    const laid: LaidRange[] = [];
    for (const window of getSpeechRangeWindows(laidRanges)) {
      const range = laidRanges.find((candidate) => candidate === window.range);
      if (range === undefined) continue;
      const file = range.path;
      const probed = await probeAudio(file, aborting);
      if (!probed.ok) return err(`${describeRange(range)}: the cleaned voice at ${file} does not read (${probed.error}); delete it and run again.`);
      const inputGainDb = await getCachedInputGainDb(range, { sound: sounds[id], file, ...aborting });
      const gainDb = Math.round((clipGainDb - inputGainDb) * 100) / 100 || 0;
      range.gainDb = gainDb;
      if (gainDb !== 0) log(`voice isolation: ${describeRange(range)} was cut from the clip's sound at ${String(inputGainDb)} dB, laid over it at ${String(clipGainDb)} dB: raised by ${String(gainDb)} dB.`);
      laid.push({ window, file, isMono: probed.probe.channels === 1, gainDb });
    }
    const output = join(buildDir, "audio", `${id}.ranges.wav`);
    mkdirSync(join(buildDir, "audio"), { recursive: true });
    await runFfmpeg(`Laying the cleaned voice over clip ${id}`, buildRangeLayArgs(getSound(clip), laid, output, { fadeMs: options.fadeMs ?? DEFAULT_SPEECH_RANGE_FADE_MS }), { ...aborting, output });
    speech[id] = output;
  }
  return ok({ speech, speechGainDb, speechPreGain, ranges });
}

/**
 * The gain of the sound a laid range's cleaned voice was cut from (issue #1159): the clip's pre-gain when it was bought
 * in this call; its record (`getSpeechRangeGainPath`) when there is one; else told from its loudness against the same
 * range of the clip's pre-gained sound (`getRangeInputGainDb`), for a range cached before the record existed.
 */
async function getCachedInputGainDb(range: IsolatedSpeechRange, input: { sound: ClipSound | undefined; file: string; signal?: AbortSignal }): Promise<number> {
  const clipGainDb = input.sound?.gainDb ?? 0;
  if (range.outcome.kind === "bought" || input.sound === undefined) return clipGainDb;
  const record = getSpeechRangeGainPath(input.file);
  if (existsSync(record)) {
    const recorded = readSpeechRangeGain(readFileSync(record, "utf8"));
    if (recorded !== null) return recorded;
  }
  if (clipGainDb === 0) return 0;
  const cleanedLufs = await measureRangeLoudness(`the cleaned voice of ${describeRange(range)}`, buildRangeMeasureArgs(input.file), input.signal);
  const baseLufs = await measureRangeLoudness(`${describeRange(range)} of the clip's sound`, buildRangeMeasureArgs(input.sound.file, range), input.signal);
  return getRangeInputGainDb({ clipGainDb, cleanedLufs, baseLufs });
}

/** Integrated loudness in LUFS of a measuring pass (`buildRangeMeasureArgs`); null for silence. Throws naming `label` when ffmpeg fails. */
async function measureRangeLoudness(label: string, args: string[], signal: AbortSignal | undefined): Promise<number | null> {
  const step = `Measuring ${label}`;
  const measured = await runProcess({ command: "ffmpeg", args, ...(signal === undefined ? {} : { signal }) });
  if (measured.kind === "not-started") throw new Error(`${step}: ffmpeg did not start (${measured.error}).`);
  if (measured.code !== 0) throw new Error(`${step}: ffmpeg ended with code ${String(measured.code)}: ${measured.stderr.trim().split("\n").slice(-3).join(" | ")}.`);
  const measurement = readLoudnessMeasurement(measured.stderr);
  if (measurement === null) throw new Error(`${step}: ffmpeg printed no loudnorm measurement.`);
  return isSilent(measurement) ? null : measurement.inputI;
}

type IsolationAnswer = { ok: true; paid: PaidAudio; attempts: number } | { ok: false; error: string; attempts: number; providerFailure: ProviderFailure | null };

/** Asks the provider for one range's cleaned voice, again after each retryable refusal up to `retry.attempts`; a cancel throws. */
async function isolateWithRetries(input: {
  audio: string;
  isolation: IsolationProvider;
  retry: SpeechRangeRetry;
  signal?: AbortSignal;
  onRefused: (error: string, attempt: number, providerFailure: ProviderFailure | null) => void;
}): Promise<IsolationAnswer> {
  const { audio, isolation, retry, signal, onRefused } = input;
  const attempts = Math.max(1, Math.floor(retry.attempts ?? DEFAULT_SPEECH_RANGE_ATTEMPTS));
  const delays = retry.delaysMs ?? DEFAULT_SPEECH_RANGE_RETRY_DELAYS_MS;
  const wait = retry.wait ?? waitFor;
  let error = "";
  let providerFailure: ProviderFailure | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      await wait(delays[Math.min(attempt - 2, delays.length - 1)] ?? 0, signal);
      signal?.throwIfAborted();
    }
    const cleaned = await isolation.isolate({ audio, ...(signal === undefined ? {} : { signal }) });
    signal?.throwIfAborted();
    if (cleaned.ok) return { ok: true, paid: toPaidAudio(cleaned.value), attempts: attempt };
    error = cleaned.error;
    providerFailure = cleaned.providerFailure ?? null;
    onRefused(error, attempt, providerFailure);
    if (providerFailure?.isRetryable === false) return { ok: false, error, attempts: attempt, providerFailure };
  }
  return { ok: false, error, attempts, providerFailure };
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
