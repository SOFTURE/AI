import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";

import { LAYOUTS, resolveLayout, type LayoutOverride } from "../compose/timeline.js";
import type { BrandColors } from "../config/colors.js";
import type { BrandFont } from "../config/config.js";
import type { SfxEvent } from "../config/schema.js";
import { getHyperframesBin, getHyperframesEnv } from "../render/hyperframes.js";
import { copyFonts } from "../render/render.js";
import type { TtsResult } from "../voice/provider.js";
import type { TimedWord } from "../voice/voiceover.js";
import { checkMusicFileType, describeAudioProbe, probeAudio } from "./audio.js";
import { prepareClipSounds } from "./clip-sound.js";
import { readCachedTranscript, writeCacheFile, writeTranscript } from "./cache.js";
import { composeFootage, END_CARD_SECONDS, getFootageFilmSeconds, getFootageSfxCues } from "./compose.js";
import { findMissingCaptionGlyphs, getCaptionBounds, getFootageCaptionLayout } from "./captions.js";
import { err, getProviderFootageFailure, ok, type FootageResult } from "./failure.js";
import { findLowDiskProblems, getFreeBytes, getRenderTempDir, type FreeBytesReader } from "./disk.js";
import { buildEdl, getEdlDuration, readEdl, remapWords, validateEdl, type Edl } from "./edl.js";
import { makePlaceholderTranscript } from "./fake.js";
import { chooseCutTransitions, type CutMeasure } from "./cuts.js";
import { declickSpeech, describeDeclick, type DeclickReport } from "./declick.js";
import { DEFAULT_AUTO_THRESHOLD, getDeclickLevel, getFootageEdit, type FootageClip, type FootageFilm, type MusicSource } from "./film.js";
import { getFilmKeyTerms } from "./keyterms.js";
import { buildFilmMixArgs } from "./film-mix.js";
import {
  AUDIO_BITRATE_RANGE_KBPS,
  buildMixArgs,
  DEFAULT_LOUDNESS,
  formatDb,
  getFirstMixCeiling,
  getLoudnessVerdict,
  getMixAttempts,
  getMixFilter,
  getMixGain,
  getMixTolerance,
  getNextMixCeiling,
  measureLoudness,
  normalizeLoudness,
  solveMixGain,
  type LoudnessMeasurement,
  type MixAttempt,
  type MixLoudness,
  type MixLoudnessTarget,
} from "./loudness.js";
import { duckingKeyframes, getDuckingOptions } from "./music.js";
import { FOOTAGE_FPS, normalizeFootage, type Frame, type NormalizeEncoder } from "./normalize.js";
import { buildPictureConcatArgs, buildPictureList, buildPicturePieceArgs, getPictureFrames, planFootagePicture } from "./picture.js";
import { describeProbe, getTrimmedDuration, probeFootage, type FootageProbe } from "./probe.js";
import {
  getClipCacheKey,
  getDownloadPath,
  getEdlPath,
  getIsolatedCache,
  getPromptMusicCache,
  getTranscriptCache,
  getVideoMusicCache,
  isUrl,
  type CacheEntry,
} from "./paid.js";
import { runFfmpeg, runProcess, withFfmpegFailureReporting, type FfmpegFailureHook, type FfmpegFailureReporting } from "./process.js";
import { splitFilmSentences, type Sentence } from "./sentences.js";
import {
  buildCoverArgs,
  buildFinishArgs,
  clampCoverSeconds,
  findFinishProblems,
  findFinishVideoProblems,
  getCoverPath,
  getDefaultCoverSeconds,
  isPublishableAudio,
  isPublishableVideo,
  probeFilmFacts,
  readTopLevelBoxes,
  type FinishVideo,
} from "./publish.js";
import { describePaidSteps, toPaidAudio, type FootageCharge, type FootageProgress, type FootageProviders, type FootageStage, type PaidAudio, type PaidStep } from "./providers.js";
import { buildAudioArgs, buildCutPreviewArgs, buildLastFrameArgs, buildMusicArgs, buildSpeechArgs, getSpeechCutOptions } from "./render.js";

export { getEdlPath } from "./paid.js";

/**
 * The footage film end to end, as standalone steps (`prepareFootage` → `transcribeFootage` → `cutFootage` →
 * `renderFootage`) and as one call (`renderFootageFilm`). Paid calls happen only with `isCommit`; without it a step
 * that would pay returns a dry run with the estimate. `isPlaceholder` replaces every paid call with a free stand-in
 * (a transcript from each clip's `script`, no isolation, no generated music) and keeps its files apart from the real
 * film's (`placeholder/` in the build folder, its own EDL).
 *
 * Build folder layout: `sources/` (downloaded URLs), `clips/<id>.mp4` (normalized), `audio/<id>.wav` (the clip's
 * lossless, pre-gained sound; `audio/<id>.isolated.wav` its cleaned voice), `edl.json`
 * (`edl.placeholder.json`), `assets/`, `index.html`, `render.mp4` (hyperframes' output until the final pass).
 *
 * The finished film is publishable: the speech track normalized to a loudness target before the music goes under it,
 * H.264 (Constrained Baseline, Main or High), AAC 48 kHz stereo, fast start, a cover JPG next to it, and its facts
 * read back from the written file.
 *
 * Every step spawns ffmpeg, ffprobe and hyperframes asynchronously, so a jobs worker's event loop (and its lease
 * heartbeat) keeps running. `signal` stops a run: the child process is killed, its partial file removed, and the
 * step rejects with the signal's reason. `onProgress` reports each stage in seconds of media, `onCharge` each paid
 * call made.
 */

const require = createRequire(import.meta.url);
/** Bumped when the normalized format changes, so older normalized clips are made again. */
const NORMALIZE_VERSION = 2;

export type { FootageResult } from "./failure.js";

export interface FootageBrand {
  name: string;
  /** BCP 47, e.g. `en-US`. */
  locale: string;
  colors: BrandColors;
  fonts: { heading: BrandFont | null; body: BrandFont | null };
  logo: string | null;
}

export interface FootageRunOptions {
  /** The film's build folder (`<buildDir>/<film id>` in the CLI). */
  buildDir: string;
  /** The paid cache's root; files go to `<cacheDir>/<film id>/`. */
  cacheDir: string;
  providers: FootageProviders;
  /** Only `true` lets a provider spend money. */
  isCommit: boolean;
  isPlaceholder: boolean;
  log: (line: string) => void;
  /** Downloads clip URLs; injected in tests. */
  fetch?: typeof globalThis.fetch;
  /** Stops the run: the running child process is killed and the step rejects with the signal's reason. */
  signal?: AbortSignal;
  onProgress?: (progress: FootageProgress) => void;
  /** Called after each paid call, for the app's own spend ledger. */
  onCharge?: (charge: FootageCharge) => void;
  /**
   * How the normalized clips are encoded (`preset`, `threads`): a small worker trades file size for speed. Not part of
   * the normalize stamp, so changing it does not normalize clips already made again.
   */
  normalize?: NormalizeEncoder;
  /**
   * Called when an ffmpeg step fails, before the run throws, with exactly what ran: the arguments, the folder, the
   * whole stderr and the inputs (`FfmpegFailure`). A promise is awaited, so `writeFfmpegFailure` can keep it for a
   * person to run again. Every failure also gets one `log` line with the step and its full command.
   */
  onFfmpegFailure?: FfmpegFailureHook;
}

export interface PreparedClip {
  clip: FootageClip;
  /** The source as read (a URL's downloaded copy). */
  source: string;
  probe: FootageProbe;
  /** The normalized clip. */
  file: string;
  /** Seconds after the trim. */
  duration: number;
}


export type TranscribeOutcome =
  | { kind: "dry-run"; steps: PaidStep[] }
  | {
      kind: "ready";
      /** Each clip's words, times from its trimmed start. */
      words: Record<string, TimedWord[]>;
      /** The audio each clip's speech is cut from (the cleaned voice when isolated). */
      speech: Record<string, string>;
    };

export function getFrame(film: Pick<FootageFilm, "format">): Frame {
  return LAYOUTS[film.format].frame;
}

/** Reports one stage's progress over its items, each `seconds` long; the reporter takes an item's index and its seconds done. */
function createStageProgress(
  onProgress: FootageRunOptions["onProgress"],
  step: FootageStage,
  items: { item: string; seconds: number }[],
): (index: number, seconds: number) => void {
  const total = items.reduce((sum, item) => sum + item.seconds, 0);
  const offsets = items.map((_, index) => items.slice(0, index).reduce((sum, item) => sum + item.seconds, 0));
  return (index, seconds) => {
    const entry = items[index];
    if (onProgress === undefined || entry === undefined) return;
    const done = (offsets[index] ?? 0) + Math.min(Math.max(seconds, 0), entry.seconds);
    onProgress({ step, item: entry.item, itemIndex: index + 1, itemCount: items.length, done: Math.round(done * 1000) / 1000, total: Math.round(total * 1000) / 1000 });
  };
}

/** The ffmpeg failure reporting of a footage entry point: its `log` and its `onFfmpegFailure`. */
export function getFfmpegReporting(options: Pick<FootageRunOptions, "log" | "onFfmpegFailure">): FfmpegFailureReporting {
  return { log: options.log, ...(options.onFfmpegFailure === undefined ? {} : { onFailure: options.onFfmpegFailure }) };
}

/** Rejects with the signal's reason once the run was aborted (before a paid call, which the provider may not stop). */
function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

async function download(url: string, dir: string, options: Pick<FootageRunOptions, "fetch" | "log" | "signal">): Promise<FootageResult<string>> {
  const file = getDownloadPath(url, dir);
  if (existsSync(file)) return ok(file);
  options.log(`download: ${url}`);
  let response: Response;
  try {
    response = await (options.fetch ?? globalThis.fetch)(url, { signal: options.signal ?? null });
  } catch (error) {
    throwIfAborted(options.signal);
    return err(`downloading ${url} failed: ${String(error)}`);
  }
  if (!response.ok) return err(`downloading ${url}: the server answered ${response.status}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${file}.part`, Buffer.from(await response.arrayBuffer()));
  cpSync(`${file}.part`, file);
  rmSync(`${file}.part`, { force: true });
  return ok(file);
}

/** The stamp that says a normalized clip was made from this source with these settings. */
function getNormalizeStamp(clip: FootageClip, source: string, frame: Frame): string {
  const stat = statSync(source);
  return JSON.stringify({ version: NORMALIZE_VERSION, source: resolve(source), size: stat.size, mtime: stat.mtimeMs, trim: clip.trim, fit: clip.fit, frame });
}

/** Downloads URL clips, probes every clip (all problems at once) and a local music file, normalizes each clip that changed. */
export function prepareFootage(film: FootageFilm, options: Pick<FootageRunOptions, "buildDir" | "log" | "fetch" | "signal" | "onProgress" | "normalize" | "onFfmpegFailure">): Promise<FootageResult<PreparedClip[]>> {
  return withFfmpegFailureReporting(getFfmpegReporting(options), () => runPrepareFootage(film, options));
}

/** The body of `prepareFootage`, inside its ffmpeg failure reporting. */
async function runPrepareFootage(
  film: FootageFilm,
  options: Pick<FootageRunOptions, "buildDir" | "log" | "fetch" | "signal" | "onProgress" | "normalize">,
): Promise<FootageResult<PreparedClip[]>> {
  const { buildDir, log, signal } = options;
  if (film.clips.length === 0) return err(`footage film ${film.id} has no clips.`, { kind: "input" });
  const sources: Record<string, string> = {};
  for (const clip of film.clips) {
    if (!isUrl(clip.source)) {
      if (!existsSync(clip.source)) return err(`clip "${clip.id}": no file at ${clip.source}`, { kind: "input" });
      sources[clip.id] = clip.source;
      continue;
    }
    const downloaded = await download(clip.source, join(buildDir, "sources"), options);
    if (!downloaded.ok) return err(`clip "${clip.id}": ${downloaded.error}`, downloaded.failure);
    sources[clip.id] = downloaded.value;
  }
  const probed = await probeFootage(film.clips, sources, signal === undefined ? {} : { signal });
  if (!probed.ok) return err(probed.errors.join("\n"));
  if (film.music.source.kind === "file") {
    const music = await checkMusicFile(film.music.source, options);
    if (!music.ok) return music;
  }
  const frame = getFrame(film);
  const clipsDir = join(buildDir, "clips");
  mkdirSync(clipsDir, { recursive: true });
  const prepared: PreparedClip[] = [];
  const stale: { clip: PreparedClip; stamp: string; stampPath: string }[] = [];
  for (const { clip, file: source, probe } of probed.clips) {
    log(describeProbe(clip, probe));
    const file = join(clipsDir, `${clip.id}.mp4`);
    const stampPath = join(clipsDir, `${clip.id}.json`);
    const stamp = getNormalizeStamp(clip, source, frame);
    const entry: PreparedClip = { clip, source, probe, file, duration: getTrimmedDuration(clip, probe) };
    if (!existsSync(file) || !existsSync(stampPath) || readFileSync(stampPath, "utf8") !== stamp) stale.push({ clip: entry, stamp, stampPath });
    prepared.push(entry);
  }
  const progress = createStageProgress(options.onProgress, "normalize", stale.map(({ clip }) => ({ item: clip.clip.id, seconds: clip.duration })));
  for (const [index, { clip, stamp, stampPath }] of stale.entries()) {
    progress(index, 0);
    // The stamp goes first, so a normalize stopped half-way never leaves a stamp that vouches for a partial clip.
    rmSync(stampPath, { force: true });
    await normalizeFootage(
      { clip: clip.clip, file: clip.source, probe: clip.probe, frame, output: clip.file, ...(options.normalize === undefined ? {} : { encoder: options.normalize }) },
      { ...(signal === undefined ? {} : { signal }), onSeconds: (seconds) => progress(index, seconds) },
    );
    writeFileSync(stampPath, stamp);
    progress(index, clip.duration);
  }
  return ok(prepared);
}

/** The cache identity of a clip's source part: its bytes and its trim. */
function getClipKey(clip: PreparedClip): Promise<string> {
  return getClipCacheKey(clip.source, clip.clip);
}

/** The cached cleaned voice (the provider's file) decoded into the build folder as lossless WAV, named by the clip's id. */
async function decodeIsolatedVoice(cached: string, clipId: string, buildDir: string, signal: AbortSignal | undefined): Promise<string> {
  const output = join(buildDir, "audio", `${clipId}.isolated.wav`);
  mkdirSync(dirname(output), { recursive: true });
  await runFfmpeg(`Decoding the cleaned voice of clip ${clipId}`, buildAudioArgs(cached, output), { ...(signal === undefined ? {} : { signal }), output });
  return output;
}

/** Each clip's lossless, pre-gained sound (`prepareClipSounds`), by clip id. */
async function getClipSoundFiles(clips: PreparedClip[], buildDir: string, signal: AbortSignal | undefined): Promise<Record<string, string>> {
  const sounds = await prepareClipSounds(clips, { buildDir, ...(signal === undefined ? {} : { signal }) });
  return Object.fromEntries(Object.entries(sounds).map(([id, sound]) => [id, sound.file]));
}

/** The free transcripts of `--placeholder`, written under `placeholder/` for a look; the speech is each clip's lossless sound. */
async function transcribePlaceholder(clips: PreparedClip[], buildDir: string, signal: AbortSignal | undefined): Promise<TranscribeOutcome> {
  const words: Record<string, TimedWord[]> = {};
  for (const clip of clips) {
    words[clip.clip.id] = clip.clip.role === "talk" ? makePlaceholderTranscript(clip.clip.script, clip.duration) : [];
    writeTranscript(join(buildDir, "placeholder", `${clip.clip.id}.transcript.json`), words[clip.clip.id] ?? []);
  }
  return { kind: "ready", words, speech: await getClipSoundFiles(clips, buildDir, signal) };
}

/** The paid music step, when the film's music still has to be bought; null when it is cached or free. */
export function getMusicPaidStep(film: FootageFilm, options: Pick<FootageRunOptions, "cacheDir" | "providers">, seconds: number): PaidStep | null {
  const source = film.music.source;
  if (source.kind === "none" || source.kind === "file") return null;
  if (source.kind === "prompt" && existsSync(getPromptMusicCache(film, options).path)) return null;
  return { kind: "music", item: "film", provider: options.providers.music.id, seconds };
}

/**
 * Each talking clip's words with times, from the cache or (with `isCommit`) from the speech-to-text provider, the
 * voice cleaned first when the film isolates it. Without `isCommit`, a cache miss returns the dry run: every paid
 * call the film still needs, music included, with its length.
 */
export function transcribeFootage(film: FootageFilm, clips: PreparedClip[], options: FootageRunOptions): Promise<FootageResult<TranscribeOutcome>> {
  return withFfmpegFailureReporting(getFfmpegReporting(options), () => runTranscribeFootage(film, clips, options));
}

/** The body of `transcribeFootage`, inside its ffmpeg failure reporting. */
async function runTranscribeFootage(film: FootageFilm, clips: PreparedClip[], options: FootageRunOptions): Promise<FootageResult<TranscribeOutcome>> {
  const { buildDir, providers, log, signal } = options;
  if (options.isPlaceholder) return ok(await transcribePlaceholder(clips, buildDir, signal));
  const keyTerms = getFilmKeyTerms(film);
  if (!keyTerms.ok) return err(`footage film ${film.id}: ${keyTerms.errors.join(" ")}`, { kind: "input" });
  const sttKeyTerms = keyTerms.terms.length === 0 ? {} : { keyTerms: keyTerms.terms };
  const plan: { clip: PreparedClip; isolated: CacheEntry | null; transcript: CacheEntry }[] = [];
  const steps: PaidStep[] = [];
  for (const clip of clips) {
    if (clip.clip.role !== "talk") continue;
    const clipKey = await getClipKey(clip);
    const isolated = getIsolatedCache(film, clipKey, options);
    const transcript = getTranscriptCache(film, clipKey, options);
    if (isolated !== null && !existsSync(isolated.path)) steps.push({ kind: "isolate", item: `clip ${clip.clip.id}`, provider: providers.isolation.id, seconds: clip.duration });
    if (!existsSync(transcript.path)) steps.push({ kind: "transcribe", item: `clip ${clip.clip.id}`, provider: providers.stt.id, seconds: clip.duration });
    plan.push({ clip, isolated, transcript });
  }
  if (steps.length > 0 && !options.isCommit) {
    const total = clips.reduce((sum, clip) => sum + clip.duration, 0) + (film.endCard === null ? 0 : END_CARD_SECONDS);
    const music = getMusicPaidStep(film, options, total);
    const all = music === null ? steps : [...steps, music];
    for (const line of describePaidSteps(all)) log(line);
    log("footage DRY RUN: nothing was sent. Run with --commit to pay, or with --placeholder to rehearse for free.");
    return ok({ kind: "dry-run", steps: all });
  }
  const words: Record<string, TimedWord[]> = {};
  for (const clip of clips) words[clip.clip.id] = [];
  // Every clip's sound, lossless and pre-gained: what the isolator, the speech to text and the speech track hear (#1139).
  const speech = await getClipSoundFiles(clips, buildDir, signal);
  const isolating = plan.filter(({ isolated }) => isolated !== null && !existsSync(isolated.path));
  const transcribing = plan.filter(({ transcript }) => !existsSync(transcript.path));
  const isolateProgress = createStageProgress(options.onProgress, "isolate", isolating.map(({ clip }) => ({ item: clip.clip.id, seconds: clip.duration })));
  const transcribeProgress = createStageProgress(options.onProgress, "transcribe", transcribing.map(({ clip }) => ({ item: clip.clip.id, seconds: clip.duration })));
  for (const entry of plan) {
    const { clip, isolated, transcript } = entry;
    const id = clip.clip.id;
    const sound = speech[id] ?? clip.file;
    let sttInput: string | null = null;
    if (isolated !== null) {
      if (!existsSync(isolated.path)) {
        const index = isolating.indexOf(entry);
        isolateProgress(index, 0);
        throwIfAborted(signal);
        log(`voice isolation (${providers.isolation.id}): clip ${id}, ${clip.duration.toFixed(1)} s.`);
        const cleaned = await providers.isolation.isolate({ audio: sound, ...(signal === undefined ? {} : { signal }) });
        throwIfAborted(signal);
        if (!cleaned.ok) return err(`clip "${id}": ${cleaned.error}`, getProviderFootageFailure(cleaned.providerFailure));
        const paid = toPaidAudio(cleaned.value);
        writeCacheFile(isolated.path, paid.audio);
        options.onCharge?.({ step: "isolate", item: id, provider: providers.isolation.id, units: clip.duration, ...(paid.credits === undefined ? {} : { credits: paid.credits }), cacheKey: isolated.key });
        log(`voice isolation: saved ${isolated.path} (commit it).`);
        isolateProgress(index, clip.duration);
      }
      // The provider's file decoded once: the speech track and the speech to text read it lossless, named by the clip.
      const decoded = await decodeIsolatedVoice(isolated.path, id, buildDir, signal);
      speech[id] = decoded;
      sttInput = decoded;
    }
    const cached = readCachedTranscript(transcript.path);
    if (!cached.ok) return err(cached.error);
    if (cached.words !== null) {
      log(`transcript: clip ${id} from the cache, nothing spent.`);
      words[id] = cached.words;
      continue;
    }
    const index = transcribing.indexOf(entry);
    transcribeProgress(index, 0);
    // The provider sees the clip's id as the file name, for the cleaned voice as for the plain sound.
    const input = sttInput ?? sound;
    throwIfAborted(signal);
    log(`speech to text (${providers.stt.id}): clip ${id}, ${clip.duration.toFixed(1)} s.`);
    const result = await providers.stt.transcribe({ audio: input, language: film.language, ...sttKeyTerms, ...(signal === undefined ? {} : { signal }) });
    throwIfAborted(signal);
    if (!result.ok) return err(`clip "${id}": ${result.error}`, getProviderFootageFailure(result.providerFailure));
    writeTranscript(transcript.path, result.value.words);
    const { credits } = result.value;
    options.onCharge?.({ step: "transcribe", item: id, provider: providers.stt.id, units: clip.duration, ...(credits === undefined ? {} : { credits }), ...(keyTerms.terms.length === 0 ? {} : { keyTerms: keyTerms.terms.length }), cacheKey: transcript.key });
    log(`transcript: clip ${id}, ${result.value.words.length} words, saved ${transcript.path} (commit it).`);
    transcribeProgress(index, clip.duration);
    words[id] = result.value.words;
  }
  return ok({ kind: "ready", words, speech });
}

/** The talking clips' sentences with their ids (`s1`…), as `buildEdl` names them, for choosing what to keep. */
export function getFootageSentences(clips: PreparedClip[], words: Record<string, TimedWord[]>): Sentence[] {
  return splitFilmSentences(clips.map((clip) => ({ id: clip.clip.id, role: clip.clip.role, words: words[clip.clip.id] ?? [] })));
}

function buildFilmEdl(film: FootageFilm, clips: PreparedClip[], words: Record<string, TimedWord[]>, keepSentences: readonly string[] | undefined): Edl {
  return buildEdl(
    film.id,
    clips.map((clip) => ({ id: clip.clip.id, role: clip.clip.role, duration: clip.duration, words: words[clip.clip.id] ?? [] })),
    film.cut,
    film.transitions,
    { isKenBurns: getFootageEdit(film).kenBurnsPercent > 0, ...(keepSentences === undefined ? {} : { keepSentences }) },
  );
}

function writeEdl(edl: Edl, edlPath: string): void {
  mkdirSync(dirname(edlPath), { recursive: true });
  writeFileSync(edlPath, `${JSON.stringify(edl, null, 2)}\n`);
}

/**
 * The cut from the transcripts, written to the EDL file (replacing what is there); `keepSentences` keeps only those
 * sentences. Sync, so it never looks at the frames: with `transitions.jump: "auto"` the jump cuts stay plain cuts, and
 * `cutFootageFilm` is the step that chooses them.
 */
export function cutFootage(film: FootageFilm, clips: PreparedClip[], words: Record<string, TimedWord[]>, edlPath: string, options: { keepSentences?: readonly string[] } = {}): Edl {
  const edl = buildFilmEdl(film, clips, words, options.keepSentences);
  writeEdl(edl, edlPath);
  return edl;
}

export interface CutFootageFilmOptions {
  /** The sentence ids to keep; absent keeps all. */
  keepSentences?: readonly string[];
  signal?: AbortSignal;
  /** Called when a cut frame's ffmpeg step fails, before the cut throws (`FootageRunOptions.onFfmpegFailure`). */
  onFfmpegFailure?: FfmpegFailureHook;
}

/** The file next to the EDL that records what the auto transitions measured. */
export const CUTS_FILE = "cuts.json";

/**
 * The cut as `cutFootage` builds it, with `transitions.jump: "auto"` resolved from the frames of the normalized clips
 * (`chooseCutTransitions`): each jump cut gets `zoom` or `fade`, and what it measured is answered and written to
 * `cuts.json` next to the EDL, so an app or an agent sees why. Otherwise the same as `cutFootage`, and `cuts` is empty.
 */
export function cutFootageFilm(film: FootageFilm, clips: PreparedClip[], words: Record<string, TimedWord[]>, edlPath: string, options: CutFootageFilmOptions = {}): Promise<{ edl: Edl; cuts: CutMeasure[] }> {
  return withFfmpegFailureReporting(options.onFfmpegFailure === undefined ? {} : { onFailure: options.onFfmpegFailure }, () => runCutFootageFilm(film, clips, words, edlPath, options));
}

/** The body of `cutFootageFilm`, inside its ffmpeg failure reporting. */
async function runCutFootageFilm(
  film: FootageFilm,
  clips: PreparedClip[],
  words: Record<string, TimedWord[]>,
  edlPath: string,
  options: CutFootageFilmOptions = {},
): Promise<{ edl: Edl; cuts: CutMeasure[] }> {
  let edl = buildFilmEdl(film, clips, words, options.keepSentences);
  let cuts: CutMeasure[] = [];
  const cutsPath = join(dirname(edlPath), CUTS_FILE);
  rmSync(cutsPath, { force: true });
  if (film.transitions.jump === "auto") {
    const chosen = await chooseCutTransitions(edl, Object.fromEntries(clips.map((clip) => [clip.clip.id, clip.file])), {
      workDir: join(dirname(edlPath), "cut-frames"),
      ...(film.transitions.autoThreshold === undefined ? {} : { threshold: film.transitions.autoThreshold }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    edl = chosen.edl;
    cuts = chosen.cuts;
    mkdirSync(dirname(cutsPath), { recursive: true });
    writeFileSync(cutsPath, `${JSON.stringify({ threshold: film.transitions.autoThreshold ?? DEFAULT_AUTO_THRESHOLD, cuts }, null, 2)}\n`);
  }
  writeEdl(edl, edlPath);
  return { edl, cuts };
}

/** One line per auto-chosen cut, for a log: `s4: zoom (difference 0.031)`. */
export function describeCutMeasures(cuts: CutMeasure[]): string[] {
  return cuts.map((cut) => `${cut.segment}: ${cut.transition} (difference ${cut.difference.toFixed(3)})`);
}

/**
 * The EDL file as written by `cutFootage` or edited by hand, checked against the clips and (a segment's own caption
 * box) against the film's frame, with the caption size the project's `layout` gives.
 */
export function readEdlFile(film: FootageFilm, clips: PreparedClip[], edlPath: string, layout: LayoutOverride = {}): FootageResult<Edl> {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(edlPath, "utf8")) as unknown;
  } catch (error) {
    return err(`${edlPath}: not JSON (${String(error)})`, { kind: "input" });
  }
  const read = readEdl(json);
  if (!read.ok) return err(`${edlPath}: ${read.error}`, { kind: "input" });
  const bounds = getCaptionBounds(getFrame(film).height, getFootageCaptionLayout(film, layout));
  const problems = validateEdl(read.edl, clips.map((clip) => ({ id: clip.clip.id, duration: clip.duration })), film.id, bounds);
  return problems.length > 0 ? err(`${edlPath}: ${problems.join("; ")}`, { kind: "input" }) : ok(read.edl);
}

/**
 * A local music file checked like an app's upload: an accepted type, then readable audio (`probeAudio`). The type comes
 * from the source's declared name (else the path) and content type; with no extension and no content type (a storage
 * key) the type check is skipped and the probe alone decides.
 */
async function checkMusicFile(source: Extract<MusicSource, { kind: "file" }>, options: Pick<FootageRunOptions, "log" | "signal">): Promise<FootageResult<string>> {
  const { path, fileName, contentType } = source;
  if (!existsSync(path)) return err(`music: no file at ${path}`, { kind: "input" });
  const name = fileName ?? path;
  if (extname(name) === "" && contentType === undefined) {
    options.log(`music: ${path} has no extension and no declared name or content type; the probe checks it.`);
  } else {
    const type = checkMusicFileType(contentType === undefined ? { fileName: name } : { fileName: name, contentType });
    if (!type.ok) return err(`music: ${type.error}`, { kind: "input" });
  }
  const probe = await probeAudio(path, options.signal === undefined ? {} : { signal: options.signal });
  if (!probe.ok) return err(`music: ${probe.error}`, { kind: "input" });
  options.log(`music: ${path} (${describeAudioProbe(probe.probe)}).`);
  return ok(path);
}

/** Where a film's music comes from, found without spending: none, a local file, or the paid cache's entry (made or not). */
export type FootageMusicLookup =
  | { kind: "none" }
  | { kind: "file"; path: string }
  | { kind: "cached"; cache: CacheEntry }
  | { kind: "missing"; cache: CacheEntry };

/**
 * The film's music as the render reads it, without a paid call: a `file` source as it is (an error when the file is
 * gone), a `prompt` or `video` source's cache entry and whether it exists. The render and the draft share it, so they
 * look up the same cache key.
 */
export async function findFootageMusic(
  film: FootageFilm,
  edl: Edl,
  clips: PreparedClip[],
  options: Pick<FootageRunOptions, "cacheDir" | "providers">,
): Promise<FootageResult<FootageMusicLookup>> {
  const source = film.music.source;
  if (source.kind === "none") return ok({ kind: "none" });
  if (source.kind === "file") return existsSync(source.path) ? ok({ kind: "file", path: source.path }) : err(`music: no file at ${source.path}`, { kind: "input" });
  let cache: CacheEntry;
  if (source.kind === "prompt") {
    cache = getPromptMusicCache(film, options);
  } else {
    const clipKeys: Record<string, string> = {};
    for (const clip of clips) clipKeys[clip.clip.id] = await getClipKey(clip);
    cache = getVideoMusicCache(film, edl, clipKeys, options);
  }
  return ok(existsSync(cache.path) ? { kind: "cached", cache } : { kind: "missing", cache });
}

/**
 * The music file for the cut: a local file as it is, generated music from the cache, or (with `isCommit`) bought
 * from the music provider and cached. Null when the film has none or the rehearsal skips generated music; a paid
 * step when it must be bought and `isCommit` is false.
 */
async function getMusic(film: FootageFilm, edl: Edl, clips: PreparedClip[], seconds: number, options: FootageRunOptions): Promise<FootageResult<string | PaidStep | null>> {
  const source = film.music.source;
  if (options.isPlaceholder && (source.kind === "prompt" || source.kind === "video")) return ok(null);
  const found = await findFootageMusic(film, edl, clips, options);
  if (!found.ok) return found;
  const music = found.value;
  if (music.kind === "none") return ok(null);
  if (music.kind === "file") return ok(music.path);
  const { providers, log, signal } = options;
  const { cache } = music;
  const { path } = cache;
  if (music.kind === "cached") {
    log(`music: from the cache ${path}, nothing spent.`);
    return ok(path);
  }
  const step: PaidStep = { kind: "music", item: "film", provider: providers.music.id, seconds };
  if (!options.isCommit) return ok(step);
  const progress = createStageProgress(options.onProgress, "music", [{ item: "film", seconds }]);
  progress(0, 0);
  const aborting = signal === undefined ? {} : { signal };
  let bought: TtsResult<Buffer | PaidAudio>;
  if (source.kind === "prompt") {
    throwIfAborted(signal);
    log(`music (${providers.music.id}): ${seconds.toFixed(1)} s.`);
    bought = await providers.music.compose({ prompt: source.prompt, seconds, ...aborting });
  } else if (source.kind === "video") {
    const preview = join(options.buildDir, "cut-preview.mp4");
    const clipFiles = Object.fromEntries(clips.map((clip) => [clip.clip.id, clip.file]));
    await runFfmpeg("The cut preview for Video to Music", buildCutPreviewArgs(edl, clipFiles, preview), { ...aborting, output: preview });
    throwIfAborted(signal);
    log(`music (${providers.music.id}): ${seconds.toFixed(1)} s.`);
    bought = await providers.music.scoreVideo({ video: preview, description: source.description, tags: source.tags, ...aborting });
  } else {
    return ok(null);
  }
  throwIfAborted(signal);
  if (!bought.ok) return err(`music: ${bought.error}`, getProviderFootageFailure(bought.providerFailure));
  const paid = toPaidAudio(bought.value);
  writeCacheFile(path, paid.audio);
  options.onCharge?.({ step: "music", item: "film", provider: providers.music.id, units: seconds, ...(paid.credits === undefined ? {} : { credits: paid.credits }), cacheKey: cache.key });
  log(`music: saved ${path} (commit it).`);
  progress(0, seconds);
  return ok(path);
}

/**
 * The speech chain's files, all lossless float WAV (issue #1139): the cut speech, the declicked track and the final
 * `speech.wav`, which the last stage that runs writes. The film's final AAC is the chain's only lossy encode.
 */
export function getSpeechChainFiles(assetsDir: string, stages: { isDeclick: boolean; isLoudness: boolean }): { rawSpeechFile: string; declickedFile: string; speechFile: string } {
  const speechFile = join(assetsDir, "speech.wav");
  const rawSpeechFile = stages.isDeclick || stages.isLoudness ? join(assetsDir, "speech.raw.wav") : speechFile;
  const declickedFile = !stages.isDeclick ? rawSpeechFile : stages.isLoudness ? join(assetsDir, "speech.declicked.wav") : speechFile;
  return { rawSpeechFile, declickedFile, speechFile };
}

export interface RenderFootageOptions extends FootageRunOptions {
  brand: FootageBrand;
  sfx: Partial<Record<SfxEvent, string>>;
  /** hyperframes' `--quality`: `draft`, `standard` or `high`. */
  quality: string;
  /** The finished MP4. */
  output: string;
  /** A project's override of the format's caption box (`marketing.json` `layout`). */
  layout?: LayoutOverride;
  /**
   * hyperframes' temp folder, passed to it as `TMPDIR` (created when missing): the clips' frames are extracted there,
   * so it needs room (a data volume, not a small tmpfs). By default the `TMPDIR` the process already has.
   */
  tempDir?: string;
  /** Reads a folder's free bytes for the disk check; injected in tests. */
  readFreeBytes?: FreeBytesReader;
  /**
   * hyperframes' capture workers (`--workers`), each a Chrome of its own; by default hyperframes' choice (one in its
   * low-memory profile). A positive whole number.
   */
  workers?: number;
  /**
   * hyperframes' low-memory profile (`--low-memory-mode`: one worker, screenshot capture): true forces it on, false
   * off; by default hyperframes turns it on by itself on a machine (or cgroup) of 8 GB or less.
   */
  lowMemory?: boolean;
  /**
   * The encoder's constant rate factor (hyperframes' `--crf`, a whole number from 0 to 51), overriding the quality
   * tier's CRF (`draft` 28, `standard` 18, `high` 15); the x264 preset stays the tier's (`ultrafast`, `medium`,
   * `slow`). `quality: "draft"` with `crf: 18` encodes fast at the published quality. By default the tier's CRF.
   */
  crf?: number;
  /**
   * Re-encode the picture in the final pass instead of copying it: H.264 High, yuv420p, at this x264 preset and CRF,
   * optionally capped at `maxBitrate` (issue #1068). `quality: "draft", crf: 18` plus `{ preset: "veryfast", crf: 20 }`
   * publishes High at a controlled size. By default the picture is copied when publishable.
   */
  finishVideo?: FinishVideo;
}

export type RenderedFootage =
  | { kind: "dry-run"; steps: PaidStep[] }
  | ({
      kind: "rendered";
      output: string;
      seconds: number;
      edlPath: string;
      /** What the speech track's declick stage did (`FootageFilm.speech.declick`); null when it is off. */
      declick: DeclickReport | null;
    } & FinishedFootage);

/**
 * Composes the cut and renders it: speech track (loudness-normalized), ducked music, end card backdrop, assets,
 * hyperframes, final pass, cover. First of all it checks that hyperframes' temp folder and the build folder have the
 * 1 GiB free hyperframes requires, so a full disk ends the run with a sentence before anything is bought or built.
 */
export function renderFootage(film: FootageFilm, clips: PreparedClip[], transcript: Extract<TranscribeOutcome, { kind: "ready" }>, edl: Edl, options: RenderFootageOptions): Promise<FootageResult<RenderedFootage>> {
  return withFfmpegFailureReporting(getFfmpegReporting(options), () => runRenderFootage(film, clips, transcript, edl, options));
}

/** The body of `renderFootage`, inside its ffmpeg failure reporting. */
async function runRenderFootage(
  film: FootageFilm,
  clips: PreparedClip[],
  transcript: Extract<TranscribeOutcome, { kind: "ready" }>,
  edl: Edl,
  options: RenderFootageOptions,
): Promise<FootageResult<RenderedFootage>> {
  const { buildDir, log, signal } = options;
  const finishVideoProblems = options.finishVideo === undefined ? [] : findFinishVideoProblems(options.finishVideo);
  if (finishVideoProblems.length > 0) return err(finishVideoProblems.join(" "), { kind: "input" });
  const lowDisk = findLowDiskProblems({ temp: getRenderTempDir(process.env, options.tempDir), build: buildDir }, options.readFreeBytes ?? getFreeBytes);
  if (lowDisk.length > 0) return err(`not enough disk space to render: ${lowDisk.join(" ")}`);
  const seconds = getFootageFilmSeconds(film, edl);
  const words = remapWords(edl, transcript.words, film.cut.fillers);
  const music = await getMusic(film, edl, clips, seconds, options);
  if (!music.ok) return music;
  if (music.value !== null && typeof music.value !== "string") {
    for (const line of describePaidSteps([music.value])) log(line);
    log("footage DRY RUN: the music was not bought. Run with --commit to pay, or with --placeholder to rehearse without it.");
    return ok({ kind: "dry-run", steps: [music.value] });
  }
  const assetsDir = join(buildDir, "assets");
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
  const clipFiles = Object.fromEntries(clips.map((clip) => [clip.clip.id, clip.file]));
  const musicFile = typeof music.value === "string" ? music.value : null;
  const aborting = signal === undefined ? {} : { signal };
  const loudness = film.loudness === undefined ? DEFAULT_LOUDNESS : film.loudness;
  const declickLevel = getDeclickLevel(film);
  const { speechFile, rawSpeechFile, declickedFile } = getSpeechChainFiles(assetsDir, { isDeclick: declickLevel !== "off", isLoudness: loudness !== null });
  const ffmpegTrack = (label: string, output: string, args: () => string[]) => (onSeconds: (done: number) => void) => runFfmpeg(label, args(), { ...aborting, output, onSeconds });
  const tracks: { item: string; seconds: number; run: (onSeconds: (done: number) => void) => Promise<void> }[] = [
    { item: "speech", seconds, run: ffmpegTrack("The speech track", rawSpeechFile, () => buildSpeechArgs(edl, transcript.speech, rawSpeechFile, getSpeechCutOptions(getFootageEdit(film)))) },
  ];
  let declick: DeclickReport | null = null;
  if (declickLevel !== "off") {
    tracks.push({
      item: "declick",
      seconds,
      run: async (onSeconds) => {
        declick = await declickSpeech({ input: rawSpeechFile, output: declickedFile, words, level: declickLevel, seconds, ...aborting, onSeconds });
        log(describeDeclick(declick));
      },
    });
  }
  if (loudness !== null) {
    tracks.push({
      item: "loudness",
      seconds,
      run: async (onSeconds) => {
        const outcome = await normalizeLoudness(declickedFile, speechFile, loudness, { ...aborting, onSeconds });
        log(
          outcome.kind === "silent"
            ? "loudness: the speech track is silent, left as it is."
            : `loudness: the speech track measured ${outcome.measured.toFixed(1)} LUFS, normalized to ${loudness.target} LUFS (true peak ${loudness.truePeak} dBTP).`,
        );
      },
    });
  }
  if (musicFile !== null) {
    const keyframes = duckingKeyframes(words, getDuckingOptions(film.music));
    const output = join(assetsDir, "music.mp3");
    tracks.push({ item: "music", seconds, run: ffmpegTrack("The music track", output, () => buildMusicArgs({ input: musicFile, seconds, keyframes, output })) });
  }
  const sfx: Partial<Record<SfxEvent, string>> = {};
  mkdirSync(join(assetsDir, "sfx"), { recursive: true });
  for (const [event, source] of Object.entries(options.sfx) as [SfxEvent, string][]) {
    const name = `${event}${extname(source)}`;
    cpSync(source, join(assetsDir, "sfx", name));
    sfx[event] = `assets/sfx/${name}`;
  }
  // The film's mix, brought to `mixLoudness` and gated before hyperframes captures a frame (issue #1124).
  const mixLoudness = getMixLoudnessTarget(film);
  // Widened: the mix track assigns it inside a closure, which narrowing does not see.
  let mixed = ok(null) as FootageResult<PreparedMix | null>;
  if (mixLoudness !== null) {
    const mixSource = join(buildDir, "mix.wav");
    const musicTrack = musicFile === null ? null : { file: join(assetsDir, "music.mp3"), seconds };
    const cues = getFootageSfxCues(film, edl, sfx).map((cue) => ({ ...cue, src: join(buildDir, cue.src) }));
    tracks.push({
      item: "mix",
      seconds,
      run: async (onSeconds) => {
        const args = buildFilmMixArgs({ speech: { file: speechFile, seconds: getEdlDuration(edl) }, music: musicTrack, sfx: cues, seconds, output: mixSource });
        await runFfmpeg("The film's mix", args, { ...aborting, output: mixSource, onSeconds });
        mixed = await mixFootage(mixLoudness, { mixSource, output: join(buildDir, "mix.m4a") }, { log, ...aborting });
        rmSync(mixSource, { force: true });
      },
    });
  }
  // A single frame: counted as a moment of work so the stage's bar still ends at its total.
  const lastFrame = join(assetsDir, "last.jpg");
  tracks.push({ item: "last frame", seconds: 0.1, run: ffmpegTrack("The end card's backdrop", lastFrame, () => buildLastFrameArgs(edl, clipFiles, lastFrame)) });
  // The cut's picture in film time, one segment after the other: the composition plays it as one <video> (#1030).
  const pictureFile = join(assetsDir, "picture.mp4");
  const pictureSeconds = getEdlDuration(edl);
  tracks.push({
    item: "picture",
    seconds: pictureSeconds,
    run: (onSeconds) => buildPicture({ film, edl, clips: clipFiles, output: pictureFile, ...(options.normalize === undefined ? {} : { encoder: options.normalize }), ...aborting, onSeconds }),
  });
  const assetProgress = createStageProgress(options.onProgress, "assets", tracks);
  for (const [index, track] of tracks.entries()) {
    assetProgress(index, 0);
    await track.run((done) => assetProgress(index, done));
    assetProgress(index, track.seconds);
  }
  // A mix that misses its target fails here, before any frame is rendered.
  const prepared = mixed;
  if (!prepared.ok) return prepared;
  const musicAsset = musicFile === null ? null : "assets/music.mp3";
  const fonts = copyFonts(options.brand.fonts, join(assetsDir, "fonts"));
  if (options.brand.logo !== null) cpSync(options.brand.logo, join(assetsDir, "logo.svg"));
  cpSync(require.resolve("gsap/dist/gsap.min.js"), join(assetsDir, "gsap.min.js"));
  const base = resolveLayout(film.format, options.layout ?? {});
  // A caption preset places the 9:16 box in a platform's safe zone; the project's own caption override still wins.
  const layout = { ...base, caption: getFootageCaptionLayout(film, options.layout ?? {}) };
  const missing = findMissingCaptionGlyphs({
    fonts: options.brand.fonts,
    captions: film.captions ? words.map((word) => word.text) : [],
    endCard: film.endCard,
    brandName: options.brand.name,
  });
  if (missing.length > 0) {
    return err(`the brand fonts cannot draw every letter of the film: ${missing.map((entry) => `${entry.font} lacks ${entry.characters.join(" ")}`).join("; ")}. Add a font file that covers them (brand.fonts).`, { kind: "input" });
  }
  const html = composeFootage({
    film,
    edl,
    words,
    frame: layout.frame,
    caption: layout.caption,
    headlineSize: layout.endCard.headlineSize,
    colors: options.brand.colors,
    fonts,
    assets: {
      clips: Object.fromEntries(clips.map((clip) => [clip.clip.id, `clips/${clip.clip.id}.mp4`])),
      picture: "assets/picture.mp4",
      speech: "assets/speech.wav",
      music: musicAsset,
      lastFrame: "assets/last.jpg",
      logo: options.brand.logo === null ? null : "assets/logo.svg",
      sfx,
    },
    brandName: options.brand.name,
    locale: options.brand.locale,
  });
  writeFileSync(join(buildDir, "index.html"), html);
  mkdirSync(dirname(options.output), { recursive: true });
  log(`render: ${edl.segments.length} segments, ${seconds.toFixed(1)} s.`);
  const renderFile = resolve(buildDir, "render.mp4");
  const rendered = await runHyperframesRender(options, renderFile, seconds);
  if (!rendered.ok) return rendered;
  const roles = Object.fromEntries(clips.map((clip) => [clip.clip.id, clip.clip.role]));
  const finished = await finishFootage(film, { renderFile, seconds, coverAt: film.cover?.at ?? getDefaultCoverSeconds(edl, roles), mix: prepared.value }, options);
  if (!finished.ok) return finished;
  return ok({ kind: "rendered", output: options.output, seconds, edlPath: getEdlPath(buildDir, options.isPlaceholder), declick, ...finished.value });
}

/** What `renderFootage` reads from the written film. */
export interface FinishedFootage {
  bytes: number;
  width: number;
  height: number;
  /** The written file's real length, which may differ from the planned `seconds` by a frame or two. */
  durationSeconds: number;
  /** The cover JPG, or null when the film has none. */
  cover: string | null;
  /** The finished file's sound as measured (EBU R128, true peak oversampled); null for a film without sound or a silent mix. */
  loudness: FinishedLoudness | null;
  /**
   * What the mix's last stage did: the film's mix as measured, the gain applied (0 when `keep: "speech"` found the
   * mix inside its window) and the limiter's ceiling; null when no stage ran (no sound, a silent mix, `mixLoudness: null`).
   */
  mix: FinishedMix | null;
}

/** The finished file's sound in `FinishedFootage`. */
export interface FinishedLoudness extends MixLoudness {
  /**
   * A sentence naming both values when the mix landed in `mixLoudness.warnTolerance`'s near-miss band instead of
   * inside its tolerance; null otherwise.
   */
  warning: string | null;
}

/** The mix's last stage in `FinishedFootage`. */
export interface FinishedMix {
  /** The film's mix before the stage. */
  measured: MixLoudness;
  gainDb: number;
  ceilingDbtp: number;
  /** What the gain kept (`MixLoudnessTarget.keep`). */
  keep: "loudness" | "speech";
  /** How many encodes the stage took. */
  encodes: number;
}

/** A film's mix brought to its target by `mixFootage`: the encoded sound the final pass muxes, and what the stage did. */
export interface PreparedMix {
  audioFile: string;
  mix: FinishedMix;
}

/** The film's mix target: `mixLoudness`, the default when absent, null when the film keeps the render's sound. */
function getMixLoudnessTarget(film: Pick<FootageFilm, "mixLoudness">): MixLoudnessTarget | null {
  return film.mixLoudness === undefined ? DEFAULT_LOUDNESS : film.mixLoudness;
}

/**
 * The mix stage over a film's sound (`mixSource`, any file ffmpeg reads): measured, brought to `target` and encoded
 * to `output` (AAC) by `finishMix`; null when the mix is silent (the final pass then keeps the render's sound). An
 * error names the last measurement. `renderFootage` runs it before hyperframes renders a frame (issue #1124).
 */
export async function mixFootage(
  target: MixLoudnessTarget,
  input: { mixSource: string; output: string },
  options: { log: (line: string) => void; signal?: AbortSignal },
): Promise<FootageResult<PreparedMix | null>> {
  const aborting = options.signal === undefined ? {} : { signal: options.signal };
  const measured = await measureLoudness(input.mixSource, target, { label: "the film's mix", ...aborting });
  if (measured.kind === "silent") {
    options.log("loudness: the film's mix is silent, left as it is.");
    return ok(null);
  }
  const mixed = await finishMix({ input: input.mixSource, output: input.output, measurement: measured.measurement, target, ...aborting });
  if (!mixed.ok) {
    rmSync(input.output, { force: true });
    return mixed;
  }
  const { attempt, tries, probes } = mixed.value;
  const keep = target.keep ?? "loudness";
  const mix = { measured: { integrated: measured.measurement.inputI, truePeak: measured.measurement.inputTp }, gainDb: attempt.gainDb, ceilingDbtp: attempt.ceilingDbtp, keep, encodes: tries };
  const kept = keep === "speech" ? ` (speech kept: ${formatDb(target.target)} ± ${getMixTolerance(target)} LUFS)` : "";
  options.log(
    `loudness: the film's mix measured ${formatDb(measured.measurement.inputI)} LUFS, true peak ${formatDb(measured.measurement.inputTp)} dBTP; ` +
      `gain ${formatDb(attempt.gainDb)} dB${kept}, limiter at ${formatDb(attempt.ceilingDbtp)} dBTP (encode ${tries} of ${getMixAttempts(target)}, ${probes} uncompressed probes).`,
  );
  return ok({ audioFile: input.output, mix });
}

/**
 * The final pass over hyperframes' render: the film's mix (`input.mix`, prepared by `mixFootage` before the render;
 * null keeps the render's sound; absent, the render's own sound goes through `mixFootage` here) muxed with the
 * picture (copied where the render already matches; `finishVideo` re-encodes it to H.264 High at its preset and CRF),
 * publishable codecs and fast start, checked with ffprobe, the finished file's sound measured and held to the target
 * (a near miss inside `warnTolerance` finishes with `loudness.warning`), then the cover and the file's facts.
 * Exported for tests only.
 */
export async function finishFootage(
  film: Pick<FootageFilm, "mixLoudness" | "cover">,
  input: { renderFile: string; seconds: number; coverAt: number; mix?: PreparedMix | null },
  options: Pick<RenderFootageOptions, "log" | "signal" | "output" | "onProgress" | "finishVideo">,
): Promise<FootageResult<FinishedFootage>> {
  const { log, signal, output } = options;
  const aborting = signal === undefined ? {} : { signal };
  const progress = createStageProgress(options.onProgress, "finish", [{ item: "film", seconds: input.seconds }]);
  progress(0, 0);
  const rendered = await probeFilmFacts(input.renderFile, aborting);
  if (!rendered.ok) return err(`the rendered film: ${rendered.error}`);
  const mixLoudness = getMixLoudnessTarget(film);
  let prepared: PreparedMix | null = input.mix ?? null;
  if (input.mix === undefined && mixLoudness !== null && rendered.facts.audio !== null) {
    const mixed = await mixFootage(mixLoudness, { mixSource: input.renderFile, output: join(dirname(input.renderFile), "mix.m4a") }, { log, ...aborting });
    if (!mixed.ok) return mixed;
    prepared = mixed.value;
  }
  const audioFile = prepared?.audioFile;
  const mix = prepared?.mix ?? null;
  const { finishVideo } = options;
  const isVideoCopied = finishVideo === undefined && isPublishableVideo(rendered.facts.video);
  const isAudioCopied = audioFile === undefined && (rendered.facts.audio === null || isPublishableAudio(rendered.facts.audio));
  const finishArgs = buildFinishArgs(input.renderFile, rendered.facts, output, { ...(audioFile === undefined ? {} : { audioFile }), ...(finishVideo === undefined ? {} : { video: finishVideo }) });
  await runFfmpeg("The film's final pass", finishArgs, { ...aborting, output, onSeconds: (done) => progress(0, done) });
  rmSync(input.renderFile, { force: true });
  if (audioFile !== undefined) rmSync(audioFile, { force: true });
  const finished = await probeFilmFacts(output, aborting);
  if (!finished.ok) return err(`the finished film: ${finished.error}`);
  const problems = findFinishProblems(finished.facts, readTopLevelBoxes(output));
  if (problems.length > 0) return err(`the finished film ${output} is not publishable: ${problems.join("; ")}.`, { kind: "publishable", problems });
  let loudness: FinishedLoudness | null = null;
  if (finished.facts.audio !== null) {
    const measured = await measureLoudness(output, mixLoudness ?? DEFAULT_LOUDNESS, { label: "the finished film", ...aborting });
    if (measured.kind === "measured") {
      const sound = { integrated: measured.measurement.inputI, truePeak: measured.measurement.inputTp };
      // A mix left as rendered (`mixLoudness: null`) or silent is reported, not held to a target it was not brought to.
      const verdict = mixLoudness === null || audioFile === undefined ? { kind: "pass" as const } : getLoudnessVerdict(sound, mixLoudness);
      if (verdict.kind === "fail") return err(`the finished film ${output} measures ${describeMixLoudness(sound)}: ${verdict.problems.join("; ")}.`, { kind: "loudness", loudness: sound });
      loudness = { ...sound, warning: verdict.kind === "warn" ? `the finished film ${output}: ${verdict.warning}` : null };
      log(`loudness: the finished film measures ${formatDb(sound.integrated)} LUFS, true peak ${formatDb(sound.truePeak)} dBTP.`);
      if (loudness.warning !== null) log(`loudness warning: ${loudness.warning}`);
    }
  }
  progress(0, input.seconds);
  const { bytes, width, height, durationSeconds } = finished.facts;
  const streams = describeFinishStreams({ isVideoCopied, isAudioCopied, hasAudio: finished.facts.audio !== null, ...(finishVideo === undefined ? {} : { finishVideo }) });
  log(`finish: ${streams} to H.264 ${finished.facts.video.profile ?? ""}, AAC 48 kHz stereo, fast start; ${width}×${height}, ${durationSeconds.toFixed(2)} s, ${bytes} bytes.`);
  let cover: string | null = null;
  if (film.cover !== null) {
    cover = getCoverPath(output);
    const at = clampCoverSeconds(input.coverAt, durationSeconds);
    if (at !== input.coverAt) log(`cover: ${input.coverAt} s is past the film's end, the frame at ${at} s is used.`);
    await runFfmpeg("The cover frame", buildCoverArgs(output, at, cover), { ...aborting, output: cover });
    log(`cover: ${cover} (at ${at} s).`);
  }
  return ok({ bytes, width, height, durationSeconds, cover, loudness, mix });
}

/**
 * The mix's sound brought to `target` on its own, at a fixed ceiling (issue #1124): the gain is solved on
 * uncompressed passes (`solveMixGain`), then the mix is encoded to AAC and measured. While the encode misses, the
 * ceiling is lowered only by its true peak excess (the codec's overshoot) and the gain solved again at it, shifted by
 * the codec's measured loudness drift, at most `getMixAttempts` encodes. A last encode inside `warnTolerance` passes
 * (the finished file's gate names the warning); otherwise an error names the last measurement.
 */
async function finishMix(input: {
  input: string;
  output: string;
  measurement: LoudnessMeasurement;
  target: MixLoudnessTarget;
  signal?: AbortSignal;
}): Promise<FootageResult<{ attempt: MixAttempt; tries: number; probes: number; measured: MixLoudness }>> {
  const aborting = input.signal === undefined ? {} : { signal: input.signal };
  const bitrate = input.target.audioBitrateKbps;
  if (bitrate !== undefined && !(Number.isInteger(bitrate) && bitrate >= AUDIO_BITRATE_RANGE_KBPS.min && bitrate <= AUDIO_BITRATE_RANGE_KBPS.max)) {
    return err(`mixLoudness.audioBitrateKbps must be a whole number from ${String(AUDIO_BITRATE_RANGE_KBPS.min)} to ${String(AUDIO_BITRATE_RANGE_KBPS.max)}, got ${String(bitrate)}.`, { kind: "input" });
  }
  const attempts = getMixAttempts(input.target);
  const probe = async (attempt: MixAttempt): Promise<MixLoudness> => {
    const probed = await measureLoudness(input.input, input.target, { label: "the film's mix through its limiter", filter: getMixFilter(attempt), ...aborting });
    // A probe through a limiter on a mix that is not silent does not go silent; if it does, the encode reports it.
    return probed.kind === "silent" ? { integrated: -Infinity, truePeak: -Infinity } : { integrated: probed.measurement.inputI, truePeak: probed.measurement.inputTp };
  };
  let ceilingDbtp = getFirstMixCeiling(input.target);
  let startGainDb = getMixGain(input.measurement.inputI, input.target);
  let shift = 0;
  let probes = 0;
  for (let tries = 1; tries <= attempts; tries += 1) {
    const solved = await solveMixGain({ ceilingDbtp, startGainDb, target: input.target, shift, measure: probe });
    probes += solved.probes.length;
    const attempt = solved.best.attempt;
    await runFfmpeg("The film's mix", buildMixArgs({ input: input.input, filter: getMixFilter(attempt), output: input.output, ...(input.target.audioBitrateKbps === undefined ? {} : { bitrateKbps: input.target.audioBitrateKbps }) }), { ...aborting, output: input.output });
    const encoded = await measureLoudness(input.output, input.target, { label: "the film's encoded mix", ...aborting });
    if (encoded.kind === "silent") return err("the film's mix measures silent after its gain and limiter.", { kind: "loudness", loudness: null });
    const measured = { integrated: encoded.measurement.inputI, truePeak: encoded.measurement.inputTp };
    const verdict = getLoudnessVerdict(measured, input.target);
    if (verdict.kind === "pass" || (verdict.kind === "warn" && tries === attempts)) return ok({ attempt, tries, probes, measured });
    if (tries === attempts) {
      return err(
        `the film's mix still measures ${describeMixLoudness(measured)} after ${attempts} encodes (last: gain ${formatDb(attempt.gainDb)} dB, ` +
          `limiter at ${formatDb(attempt.ceilingDbtp)} dBTP): ${verdict.kind === "fail" ? verdict.problems.join("; ") : ""}.`,
        { kind: "loudness", loudness: measured },
      );
    }
    shift = Number.isFinite(solved.best.measured.integrated) ? measured.integrated - solved.best.measured.integrated : 0;
    ceilingDbtp = getNextMixCeiling(attempt.ceilingDbtp, measured, input.target);
    startGainDb = attempt.gainDb;
  }
  return err(`the film's mix was not encoded: mixLoudness.attempts is ${attempts}.`, { kind: "input" });
}

/** Both measurements of a mix, as an error names them. */
function describeMixLoudness(measured: MixLoudness): string {
  return `${formatDb(measured.integrated)} LUFS integrated, ${formatDb(measured.truePeak)} dBTP true peak`;
}

/** What the final pass did to each stream, for its log line. */
function describeFinishStreams(pass: { isVideoCopied: boolean; isAudioCopied: boolean; hasAudio: boolean; finishVideo?: FinishVideo }): string {
  if (pass.finishVideo === undefined) return pass.isVideoCopied && pass.isAudioCopied ? "streams copied" : pass.isVideoCopied ? "picture copied, sound re-encoded" : "re-encoded";
  const { preset, crf, maxBitrate } = pass.finishVideo;
  const picture = `picture re-encoded (${preset} CRF ${crf}${maxBitrate === undefined ? "" : `, max ${maxBitrate}`})`;
  if (!pass.hasAudio) return picture;
  return `${picture}, sound ${pass.isAudioCopied ? "copied" : "re-encoded"}`;
}

/** hyperframes' progress lines carry a percentage (`… 42%`); the last one on a line counts. */
export function readRenderPercent(line: string): number | null {
  const matches = [...line.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%/g)];
  const last = matches.at(-1)?.[1];
  if (last === undefined) return null;
  const percent = Number(last);
  return percent >= 0 && percent <= 100 ? percent : null;
}

/**
 * hyperframes' render arguments: the quality, the encoder's CRF, the output and the memory settings the caller set.
 * Throws on invalid `workers` or `crf`.
 */
export function getHyperframesRenderArgs(options: Pick<RenderFootageOptions, "quality" | "workers" | "lowMemory" | "crf">, output: string): string[] {
  const args = ["render", "--quality", options.quality];
  if (options.crf !== undefined) {
    if (!Number.isInteger(options.crf) || options.crf < 0 || options.crf > 51) throw new Error(`crf must be a whole number from 0 to 51, got ${options.crf}.`);
    args.push("--crf", String(options.crf));
  }
  if (options.workers !== undefined) {
    if (!Number.isInteger(options.workers) || options.workers < 1) throw new Error(`workers must be a positive whole number, got ${options.workers}.`);
    args.push("--workers", String(options.workers));
  }
  if (options.lowMemory !== undefined) args.push(options.lowMemory ? "--low-memory-mode" : "--no-low-memory-mode");
  return [...args, "-o", output];
}

interface BuildPictureInput {
  film: FootageFilm;
  edl: Edl;
  clips: Record<string, string>;
  output: string;
  encoder?: NormalizeEncoder;
  signal?: AbortSignal;
  onSeconds: (done: number) => void;
}

/** Renders the picture piece by piece (one ffmpeg at a time) and joins the pieces; the pieces are removed after the join. */
async function buildPicture(input: BuildPictureInput): Promise<void> {
  const pieces = planFootagePicture(input.film, input.edl);
  const dir = join(dirname(input.output), "picture");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const aborting = input.signal === undefined ? {} : { signal: input.signal };
  const files: string[] = [];
  for (const [index, piece] of pieces.entries()) {
    const file = join(dir, `${String(index).padStart(3, "0")}.mp4`);
    const done = piece.frame / FOOTAGE_FPS;
    await runFfmpeg(`The picture of segment ${index + 1}`, buildPicturePieceArgs({ piece, clips: input.clips, frame: getFrame(input.film), output: file, ...(input.encoder === undefined ? {} : { encoder: input.encoder }) }), {
      ...aborting,
      output: file,
      onSeconds: (seconds) => input.onSeconds(done + seconds),
    });
    files.push(file);
  }
  const list = join(dir, "pieces.txt");
  writeFileSync(list, buildPictureList(files));
  await runFfmpeg("The picture's join", buildPictureConcatArgs(list, input.output), { ...aborting, output: input.output });
  rmSync(dir, { recursive: true, force: true });
  input.onSeconds(getPictureFrames(pieces) / FOOTAGE_FPS);
}

/** The hyperframes render as a child process: its lines go to the log (progress every 10 %), its percentages to `onProgress`. */
async function runHyperframesRender(options: RenderFootageOptions, output: string, seconds: number): Promise<FootageResult<null>> {
  const progress = createStageProgress(options.onProgress, "render", [{ item: "film", seconds }]);
  progress(0, 0);
  let loggedTenth = -1;
  const onLine = (line: string): void => {
    if (line.trim().length === 0) return;
    const percent = readRenderPercent(line);
    if (percent === null) {
      options.log(line.trim());
      return;
    }
    progress(0, (percent / 100) * seconds);
    // A progress line per frame would flood the log: one line per tenth of the render is kept.
    const tenth = Math.floor(percent / 10);
    if (tenth > loggedTenth) {
      loggedTenth = tenth;
      options.log(line.trim());
    }
  };
  const env = getHyperframesEnv();
  if (options.tempDir !== undefined && options.tempDir.length > 0) {
    const tempDir = resolve(options.tempDir);
    mkdirSync(tempDir, { recursive: true });
    env.TMPDIR = tempDir;
  }
  const result = await runProcess({
    command: process.execPath,
    args: [getHyperframesBin(), ...getHyperframesRenderArgs(options, output)],
    cwd: options.buildDir,
    env,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    removeOnAbort: [output],
    onStdoutLine: onLine,
    onStderrLine: onLine,
  });
  if (result.kind === "not-started") return err(`hyperframes render did not start: ${result.error}.`);
  if (result.code !== 0) return err(`hyperframes render ended with code ${String(result.code)} (signal ${result.signal ?? "-"}).`);
  progress(0, seconds);
  return ok(null);
}

export interface RenderFootageFilmOptions extends RenderFootageOptions {
  /** Build the EDL again even when the build folder holds one (by default a present EDL, maybe edited by hand, is used). */
  isRecut?: boolean;
  /** When the EDL is built: the sentence ids to keep (`getFootageSentences`, `findRetakes`); absent keeps all. */
  keepSentences?: readonly string[];
}

/**
 * The whole footage film from a `FootageFilm` object, no `marketing.json` needed: prepare, transcribe (or the dry
 * run), cut (reusing an EDL already in the build folder unless `isRecut`), render.
 */
export function renderFootageFilm(film: FootageFilm, options: RenderFootageFilmOptions): Promise<FootageResult<RenderedFootage>> {
  return withFfmpegFailureReporting(getFfmpegReporting(options), () => runRenderFootageFilm(film, options));
}

/** The body of `renderFootageFilm`, inside its ffmpeg failure reporting. */
async function runRenderFootageFilm(film: FootageFilm, options: RenderFootageFilmOptions): Promise<FootageResult<RenderedFootage>> {
  const clips = await prepareFootage(film, options);
  if (!clips.ok) return clips;
  const transcript = await transcribeFootage(film, clips.value, options);
  if (!transcript.ok) return transcript;
  if (transcript.value.kind === "dry-run") return ok(transcript.value);
  const edlPath = getEdlPath(options.buildDir, options.isPlaceholder);
  let edl: Edl;
  if (existsSync(edlPath) && options.isRecut !== true) {
    const read = readEdlFile(film, clips.value, edlPath, options.layout);
    if (!read.ok) return read;
    edl = read.value;
    options.log(`cut: ${edlPath} (${edl.segments.length} segments), as it is; softure-marketing footage --step=cut builds it again.`);
  } else {
    const cut = await cutFootageFilm(film, clips.value, transcript.value.words, edlPath, {
      ...(options.keepSentences === undefined ? {} : { keepSentences: options.keepSentences }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    edl = cut.edl;
    options.log(`cut: ${edl.segments.length} segments written to ${edlPath}.`);
    for (const line of describeCutMeasures(cut.cuts)) options.log(`  auto transition ${line}`);
  }
  return renderFootage(film, clips.value, transcript.value, edl, options);
}
