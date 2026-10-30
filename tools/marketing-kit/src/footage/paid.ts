import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import { err, ok, type TtsResult } from "../voice/provider.js";
import { footageCacheKey, getFootageCachePath, hashFile } from "./cache.js";
import { END_CARD_SECONDS, getFootageFilmSeconds } from "./compose.js";
import { readEdl, type Edl } from "./edl.js";
import type { FootageClip, FootageFilm } from "./film.js";
import { getTrimmedDuration, probeFootage } from "./probe.js";
import type { FootageProviders, FootageRates, PaidStepKind } from "./providers.js";

/**
 * Where each paid result of a footage film is cached, shared by the pipeline and by the questions an app asks before
 * a run: is this step cached (`findCachedStep`), and what will the film cost (`estimateFootageFilm`). Neither question
 * normalizes a clip or calls a provider.
 */

export interface FootageCacheOptions {
  /** The paid cache's root; files are in `<cacheDir>/<film id>/`. */
  cacheDir: string;
  providers: FootageProviders;
  /** The film's build folder: downloaded URL clips (`sources/`) and the cut (`edl.json`) are looked up there. */
  buildDir?: string;
  /** The cut, when the caller holds it; otherwise `<buildDir>/edl.json` is read. Video-scored music depends on it. */
  edl?: Edl;
}

export interface CacheEntry {
  key: string;
  path: string;
}

export const isUrl = (source: string): boolean => /^https?:\/\//i.test(source);

export function getEdlPath(buildDir: string, isPlaceholder: boolean): string {
  return join(buildDir, isPlaceholder ? "edl.placeholder.json" : "edl.json");
}

/** Where a URL clip is downloaded to inside `dir` (`<buildDir>/sources`). */
export function getDownloadPath(url: string, dir: string): string {
  const name = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const extension = extname(new URL(url).pathname).toLowerCase() || ".mp4";
  return join(dir, `${name}${extension}`);
}

/** The clip's local file: the file itself, or a URL's downloaded copy in the build folder; null when there is none yet. */
export function findLocalSource(clip: Pick<FootageClip, "source">, buildDir: string | undefined): string | null {
  if (!isUrl(clip.source)) return existsSync(clip.source) ? clip.source : null;
  if (buildDir === undefined) return null;
  const file = getDownloadPath(clip.source, join(buildDir, "sources"));
  return existsSync(file) ? file : null;
}

/** The cache identity of a clip's source part: its bytes and its trim. */
export async function getClipCacheKey(source: string, clip: Pick<FootageClip, "trim">): Promise<string> {
  return footageCacheKey("transcript", { source: await hashFile(source), trim: clip.trim });
}

/** The cleaned voice of a clip; null when the film does not isolate the voice. */
export function getIsolatedCache(film: FootageFilm, clipKey: string, options: Pick<FootageCacheOptions, "cacheDir" | "providers">): CacheEntry | null {
  if (!film.isolateVoice) return null;
  const key = footageCacheKey("isolated", { clip: clipKey, provider: options.providers.isolation.id });
  return { key, path: getFootageCachePath(options.cacheDir, film.id, "isolated", key) };
}

export function getTranscriptCache(film: FootageFilm, clipKey: string, options: Pick<FootageCacheOptions, "cacheDir" | "providers">): CacheEntry {
  const { stt } = options.providers;
  const key = footageCacheKey("transcript", { clip: clipKey, isolated: film.isolateVoice, provider: stt.id, model: stt.model, language: film.language });
  return { key, path: getFootageCachePath(options.cacheDir, film.id, "transcript", key) };
}

/** Music generated from the film's prompt: keyed by the prompt, so a re-cut never pays again. */
export function getPromptMusicCache(film: FootageFilm, options: Pick<FootageCacheOptions, "cacheDir" | "providers">): CacheEntry {
  const source = film.music.source;
  const prompt = source.kind === "prompt" ? source.prompt : "";
  const { music } = options.providers;
  const key = footageCacheKey("music", { prompt, provider: music.id, model: music.model });
  return { key, path: getFootageCachePath(options.cacheDir, film.id, "music", key) };
}

/** Music scored to the cut: keyed by the cut and the clips' bytes. `clipKeys` maps every clip id to its cache key. */
export function getVideoMusicCache(film: FootageFilm, edl: Edl, clipKeys: Record<string, string>, options: Pick<FootageCacheOptions, "cacheDir" | "providers">): CacheEntry {
  const source = film.music.source;
  const { music } = options.providers;
  const description = source.kind === "video" ? source.description : "";
  const tags = source.kind === "video" ? source.tags : [];
  const key = footageCacheKey("music", { segments: edl.segments, clips: clipKeys, description, tags, provider: music.id, model: music.model });
  return { key, path: getFootageCachePath(options.cacheDir, film.id, "music", key) };
}

/** The cut the caller passed, or the one in the build folder; null when there is none (or it does not read). */
function findEdl(options: FootageCacheOptions): Edl | null {
  if (options.edl !== undefined) return options.edl;
  if (options.buildDir === undefined) return null;
  const path = getEdlPath(options.buildDir, false);
  if (!existsSync(path)) return null;
  try {
    const read = readEdl(JSON.parse(readFileSync(path, "utf8")) as unknown);
    return read.ok ? read.edl : null;
  } catch {
    // A broken EDL file is reported by the run that reads it; here it only means the cut is unknown.
    return null;
  }
}

/** Every clip's cache key; null when a clip has no local file yet. */
async function getClipKeys(film: FootageFilm, buildDir: string | undefined): Promise<Record<string, string> | null> {
  const keys: Record<string, string> = {};
  for (const clip of film.clips) {
    const source = findLocalSource(clip, buildDir);
    if (source === null) return null;
    keys[clip.id] = await getClipCacheKey(source, clip);
  }
  return keys;
}

/** Whether the film's music is already paid for; free music (none, a file) needs nothing, so it counts as cached. */
async function isMusicCached(film: FootageFilm, options: FootageCacheOptions): Promise<boolean> {
  const source = film.music.source;
  if (source.kind === "none" || source.kind === "file") return true;
  if (source.kind === "prompt") return existsSync(getPromptMusicCache(film, options).path);
  const edl = findEdl(options);
  if (edl === null) return false;
  const clipKeys = await getClipKeys(film, options.buildDir);
  return clipKeys !== null && existsSync(getVideoMusicCache(film, edl, clipKeys, options).path);
}

/**
 * Whether a paid step costs nothing now because its result is in the cache, without network or ffmpeg. `item` is a
 * clip id (`transcribe`, `isolate`) or `film` (`music`). An unknown clip, a step the film does not take (isolation
 * when it keeps the raw voice), a URL clip not downloaded yet and video-scored music without a cut answer false.
 */
export async function findCachedStep(film: FootageFilm, step: PaidStepKind, item: string, options: FootageCacheOptions): Promise<boolean> {
  if (step === "music") return isMusicCached(film, options);
  const clip = film.clips.find((entry) => entry.id === item);
  if (clip === undefined || clip.role !== "talk") return false;
  const source = findLocalSource(clip, options.buildDir);
  if (source === null) return false;
  const clipKey = await getClipCacheKey(source, clip);
  const entry = step === "isolate" ? getIsolatedCache(film, clipKey, options) : getTranscriptCache(film, clipKey, options);
  return entry !== null && existsSync(entry.path);
}

export interface FootageEstimateItem {
  step: PaidStepKind;
  /** A clip id, or `film` for the music. */
  item: string;
  provider: string;
  units: number;
  unit: "seconds";
  /** `units` × the step's rate; 0 when cached. */
  credits: number;
  cached: boolean;
}

export interface FootageEstimate {
  items: FootageEstimateItem[];
  totalCredits: number;
}

export interface EstimateFootageOptions extends FootageCacheOptions {
  rates: FootageRates;
  signal?: AbortSignal;
}

const round = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale || 0;
};

/**
 * What a footage film will cost in the caller's credits, before anything runs: every clip probed (a URL clip not yet
 * downloaded is probed at its URL), nothing normalized, no provider called. Talking clips need speech to text (and
 * isolation when the film cleans the voice); generated music lasts the cut's length when the cut is known, else the
 * clips' length plus the end card. A cached step costs 0.
 */
export async function estimateFootageFilm(film: FootageFilm, options: EstimateFootageOptions): Promise<TtsResult<FootageEstimate>> {
  if (film.clips.length === 0) return err(`footage film ${film.id} has no clips.`);
  const files: Record<string, string> = {};
  for (const clip of film.clips) {
    const local = findLocalSource(clip, options.buildDir);
    if (local === null && !isUrl(clip.source)) return err(`clip "${clip.id}": no file at ${clip.source}`);
    files[clip.id] = local ?? clip.source;
  }
  const probed = await probeFootage(film.clips, files, options.signal === undefined ? {} : { signal: options.signal });
  if (!probed.ok) return err(probed.errors.join("\n"));
  const items: FootageEstimateItem[] = [];
  const add = (step: PaidStepKind, item: string, provider: string, units: number, cached: boolean): void => {
    items.push({ step, item, provider, units: round(units, 3), unit: "seconds", credits: cached ? 0 : round(units * options.rates[step], 2), cached });
  };
  let clipSeconds = 0;
  for (const { clip, probe } of probed.clips) {
    const seconds = getTrimmedDuration(clip, probe);
    clipSeconds += seconds;
    if (clip.role !== "talk") continue;
    const source = findLocalSource(clip, options.buildDir);
    const clipKey = source === null ? null : await getClipCacheKey(source, clip);
    const isolated = clipKey === null ? null : getIsolatedCache(film, clipKey, options);
    if (film.isolateVoice) add("isolate", clip.id, options.providers.isolation.id, seconds, isolated !== null && existsSync(isolated.path));
    const transcript = clipKey === null ? null : getTranscriptCache(film, clipKey, options);
    add("transcribe", clip.id, options.providers.stt.id, seconds, transcript !== null && existsSync(transcript.path));
  }
  const music = film.music.source;
  if (music.kind === "prompt" || music.kind === "video") {
    const edl = findEdl(options);
    const seconds = edl === null ? clipSeconds + (film.endCard === null ? 0 : END_CARD_SECONDS) : getFootageFilmSeconds(film, edl);
    add("music", "film", options.providers.music.id, seconds, await isMusicCached(film, options));
  }
  return ok({ items, totalCredits: round(items.reduce((sum, item) => sum + item.credits, 0), 2) });
}
