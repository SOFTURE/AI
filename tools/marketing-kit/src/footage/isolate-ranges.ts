import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { err, ok } from "./failure.js";
import { probeAudio } from "./audio.js";
import { writeCacheFile } from "./cache.js";
import type { Edl } from "./edl.js";
import type { FootageFilm } from "./film.js";
import { getClipCacheKey } from "./paid.js";
import { getFfmpegReporting, type FootageResult, type FootageRunOptions, type PreparedClip } from "./pipeline.js";
import { runFfmpeg, withFfmpegFailureReporting } from "./process.js";
import { toPaidAudio } from "./providers.js";
import {
  buildRangeAudioArgs,
  buildRangeLayArgs,
  getSpeechRangeCache,
  getSpeechRangeWindows,
  planSpeechRanges,
  type LaidRange,
  type SpeechRange,
} from "./speech-ranges.js";

/**
 * Voice isolation of only what the cut hears (issue #1087): each talking clip's sound ranges (`planSpeechRanges`) are
 * cleaned one by one and cached by the clip's identity, the range in milliseconds and the provider, so an unchanged
 * segment is never paid twice and a changed cut pays only its new ranges. The cleaned ranges are laid back over the
 * clip's own sound into one file as long as the clip: the speech map `renderFootage` takes.
 */

export type IsolateSpeechRangesOptions = Pick<FootageRunOptions, "buildDir" | "cacheDir" | "providers" | "isCommit" | "signal" | "onCharge" | "onProgress" | "onFfmpegFailure"> & {
  /** Seconds added on each side of a sound span; default `DEFAULT_SPEECH_RANGE_MARGIN` (0.25). */
  margin?: number;
  log?: (line: string) => void;
};

export interface IsolatedSpeechRange extends SpeechRange {
  /** The paid cache's key and file of the range's cleaned voice. */
  cacheKey: string;
  path: string;
  /** Whether the cleaned voice was in the cache before this call. */
  cached: boolean;
  /** Whether it is laid in the clip's speech file (cached, or bought with `isCommit`). */
  laid: boolean;
}

export interface IsolatedSpeech {
  /** Every clip's audio for the speech track: its laid file, or the normalized clip when none of its ranges is laid. */
  speech: Record<string, string>;
  ranges: IsolatedSpeechRange[];
}

/**
 * Cleans the voice of the ranges the cut hears and answers the speech map the render takes (`TranscribeOutcome.speech`).
 * With `isCommit` every uncached range is bought (`onCharge` step `isolate`, item the clip id, with its `range`);
 * without it only cached ranges are laid, a free draft, and `ranges` names what is still missing. Each clip with a laid
 * range gets `<buildDir>/audio/<id>.ranges.mp3`.
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
    const cache = getSpeechRangeCache(film.id, clipKey, range, { cacheDir: options.cacheDir, provider: providers.isolation.id });
    const cached = existsSync(cache.path);
    ranges.push({ ...range, cacheKey: cache.key, path: cache.path, cached, laid: cached });
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
    const cleaned = await providers.isolation.isolate({ audio: input, ...aborting });
    signal?.throwIfAborted();
    if (!cleaned.ok) return err(`${describeRange(range)}: ${cleaned.error}`);
    const paid = toPaidAudio(cleaned.value);
    writeCacheFile(range.path, paid.audio);
    range.laid = true;
    options.onCharge?.({
      step: "isolate",
      item: range.clip,
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
  const missing = ranges.filter((range) => !range.laid);
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
    await runFfmpeg(`Laying the cleaned voice over clip ${id}`, buildRangeLayArgs(clip.file, laid, output), { ...aborting, output });
    speech[id] = output;
  }
  return ok({ speech, ranges });
}

function describeRange(range: SpeechRange): string {
  return `clip ${range.clip} ${(range.startMs / 1000).toFixed(3)}-${(range.endMs / 1000).toFixed(3)} s`;
}
