import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";

import { LAYOUTS, resolveLayout, type LayoutOverride } from "../compose/timeline.js";
import type { BrandColors } from "../config/colors.js";
import type { BrandFont } from "../config/config.js";
import type { SfxEvent } from "../config/schema.js";
import { runHyperframes } from "../render/hyperframes.js";
import { copyFonts } from "../render/render.js";
import { err, ok, type TtsResult } from "../voice/provider.js";
import type { TimedWord } from "../voice/voiceover.js";
import { footageCacheKey, getFootageCachePath, hashFile, readCachedTranscript, writeCacheFile, writeTranscript } from "./cache.js";
import { composeFootage, END_CARD_SECONDS, getFootageFilmSeconds } from "./compose.js";
import { buildEdl, findEdlProblems, readEdl, remapWords, type Edl } from "./edl.js";
import { makePlaceholderTranscript } from "./fake.js";
import type { FootageClip, FootageFilm } from "./film.js";
import { duckingKeyframes } from "./music.js";
import { normalizeFootage, type Frame } from "./normalize.js";
import { describeProbe, getTrimmedDuration, probeFootage, type FootageProbe } from "./probe.js";
import { describePaidSteps, type FootageProviders, type PaidStep } from "./providers.js";
import { buildAudioArgs, buildCutPreviewArgs, buildLastFrameArgs, buildMusicArgs, buildSpeechArgs, runFfmpeg } from "./render.js";

/**
 * The footage film end to end, as standalone steps (`prepareFootage` → `transcribeFootage` → `cutFootage` →
 * `renderFootage`) and as one call (`renderFootageFilm`). Paid calls happen only with `isCommit`; without it a step
 * that would pay returns a dry run with the estimate. `isPlaceholder` replaces every paid call with a free stand-in
 * (a transcript from each clip's `script`, no isolation, no generated music) and keeps its files apart from the real
 * film's (`placeholder/` in the build folder, its own EDL).
 *
 * Build folder layout: `sources/` (downloaded URLs), `clips/<id>.mp4` (normalized), `audio/<id>.mp3`, `edl.json`
 * (`edl.placeholder.json`), `assets/`, `index.html`.
 */

const require = createRequire(import.meta.url);
/** Bumped when the normalized format changes, so older normalized clips are made again. */
const NORMALIZE_VERSION = 1;

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

export type FootageResult<T> = TtsResult<T>;

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

export function getEdlPath(buildDir: string, isPlaceholder: boolean): string {
  return join(buildDir, isPlaceholder ? "edl.placeholder.json" : "edl.json");
}

const isUrl = (source: string): boolean => /^https?:\/\//i.test(source);

async function download(url: string, dir: string, fetch: typeof globalThis.fetch, log: (line: string) => void): Promise<FootageResult<string>> {
  const name = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const extension = extname(new URL(url).pathname).toLowerCase() || ".mp4";
  const file = join(dir, `${name}${extension}`);
  if (existsSync(file)) return ok(file);
  log(`download: ${url}`);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
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

/** Downloads URL clips, probes every clip (all problems at once), normalizes each one that changed. */
export async function prepareFootage(film: FootageFilm, options: Pick<FootageRunOptions, "buildDir" | "log" | "fetch">): Promise<FootageResult<PreparedClip[]>> {
  const { buildDir, log } = options;
  if (film.clips.length === 0) return err(`footage film ${film.id} has no clips.`);
  const sources: Record<string, string> = {};
  for (const clip of film.clips) {
    if (!isUrl(clip.source)) {
      if (!existsSync(clip.source)) return err(`clip "${clip.id}": no file at ${clip.source}`);
      sources[clip.id] = clip.source;
      continue;
    }
    const downloaded = await download(clip.source, join(buildDir, "sources"), options.fetch ?? globalThis.fetch, log);
    if (!downloaded.ok) return err(`clip "${clip.id}": ${downloaded.error}`);
    sources[clip.id] = downloaded.value;
  }
  const probed = probeFootage(film.clips, sources);
  if (!probed.ok) return err(probed.errors.join("\n"));
  const frame = getFrame(film);
  const clipsDir = join(buildDir, "clips");
  mkdirSync(clipsDir, { recursive: true });
  const prepared: PreparedClip[] = [];
  for (const { clip, file: source, probe } of probed.clips) {
    log(describeProbe(clip, probe));
    const file = join(clipsDir, `${clip.id}.mp4`);
    const stampPath = join(clipsDir, `${clip.id}.json`);
    const stamp = getNormalizeStamp(clip, source, frame);
    if (!existsSync(file) || !existsSync(stampPath) || readFileSync(stampPath, "utf8") !== stamp) {
      normalizeFootage({ clip, file: source, probe, frame, output: file });
      writeFileSync(stampPath, stamp);
    }
    prepared.push({ clip, source, probe, file, duration: getTrimmedDuration(clip, probe) });
  }
  return ok(prepared);
}

/** The cache identity of a clip's source part: its bytes and its trim. */
async function getClipKey(clip: PreparedClip): Promise<string> {
  return footageCacheKey("transcript", { source: await hashFile(clip.source), trim: clip.clip.trim });
}

function extractAudio(clip: PreparedClip, buildDir: string): string {
  const audio = join(buildDir, "audio", `${clip.clip.id}.mp3`);
  mkdirSync(dirname(audio), { recursive: true });
  runFfmpeg(`Extracting the sound of clip ${clip.clip.id}`, buildAudioArgs(clip.file, audio));
  return audio;
}

/** The free transcripts of `--placeholder`, written under `placeholder/` for a look. */
function transcribePlaceholder(film: FootageFilm, clips: PreparedClip[], buildDir: string): TranscribeOutcome {
  const words: Record<string, TimedWord[]> = {};
  const speech: Record<string, string> = {};
  for (const clip of clips) {
    words[clip.clip.id] = clip.clip.role === "talk" ? makePlaceholderTranscript(clip.clip.script, clip.duration) : [];
    writeTranscript(join(buildDir, "placeholder", `${clip.clip.id}.transcript.json`), words[clip.clip.id] ?? []);
    speech[clip.clip.id] = clip.file;
  }
  return { kind: "ready", words, speech };
}

/** The paid music step, when the film's music still has to be bought; null when it is cached or free. */
export function getMusicPaidStep(film: FootageFilm, options: Pick<FootageRunOptions, "cacheDir" | "providers">, seconds: number): PaidStep | null {
  const source = film.music.source;
  if (source.kind === "none" || source.kind === "file") return null;
  if (source.kind === "prompt" && existsSync(getPromptMusicPath(film, options))) return null;
  return { kind: "music", item: "film", provider: options.providers.music.id, seconds };
}

function getPromptMusicPath(film: FootageFilm, options: Pick<FootageRunOptions, "cacheDir" | "providers">): string {
  const source = film.music.source;
  const prompt = source.kind === "prompt" ? source.prompt : "";
  const key = footageCacheKey("music", { prompt, provider: options.providers.music.id, model: options.providers.music.model });
  return getFootageCachePath(options.cacheDir, film.id, "music", key);
}

/**
 * Each talking clip's words with times, from the cache or (with `isCommit`) from the speech-to-text provider, the
 * voice cleaned first when the film isolates it. Without `isCommit`, a cache miss returns the dry run: every paid
 * call the film still needs, music included, with its length.
 */
export async function transcribeFootage(film: FootageFilm, clips: PreparedClip[], options: FootageRunOptions): Promise<FootageResult<TranscribeOutcome>> {
  const { buildDir, cacheDir, providers, log } = options;
  if (options.isPlaceholder) return ok(transcribePlaceholder(film, clips, buildDir));
  const plan: { clip: PreparedClip; isolated: string | null; transcript: string }[] = [];
  const steps: PaidStep[] = [];
  for (const clip of clips) {
    if (clip.clip.role !== "talk") continue;
    const clipKey = await getClipKey(clip);
    const isolated = film.isolateVoice ? getFootageCachePath(cacheDir, film.id, "isolated", footageCacheKey("isolated", { clip: clipKey, provider: providers.isolation.id })) : null;
    const transcriptKey = footageCacheKey("transcript", { clip: clipKey, isolated: isolated !== null, provider: providers.stt.id, model: providers.stt.model, language: film.language });
    const transcript = getFootageCachePath(cacheDir, film.id, "transcript", transcriptKey);
    if (isolated !== null && !existsSync(isolated)) steps.push({ kind: "isolate", item: `clip ${clip.clip.id}`, provider: providers.isolation.id, seconds: clip.duration });
    if (!existsSync(transcript)) steps.push({ kind: "transcribe", item: `clip ${clip.clip.id}`, provider: providers.stt.id, seconds: clip.duration });
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
  const speech: Record<string, string> = {};
  for (const clip of clips) {
    words[clip.clip.id] = [];
    speech[clip.clip.id] = clip.file;
  }
  for (const { clip, isolated, transcript } of plan) {
    const id = clip.clip.id;
    let audio: string | null = null;
    const getAudio = (): string => (audio ??= extractAudio(clip, buildDir));
    let sttInput: string | null = null;
    if (isolated !== null) {
      if (!existsSync(isolated)) {
        log(`voice isolation (${providers.isolation.id}): clip ${id}, ${clip.duration.toFixed(1)} s.`);
        const cleaned = await providers.isolation.isolate({ audio: getAudio() });
        if (!cleaned.ok) return err(`clip "${id}": ${cleaned.error}`);
        writeCacheFile(isolated, cleaned.value);
        log(`voice isolation: saved ${isolated} (commit it).`);
      }
      speech[id] = isolated;
      sttInput = isolated;
    }
    const cached = readCachedTranscript(transcript);
    if (!cached.ok) return err(cached.error);
    if (cached.words !== null) {
      log(`transcript: clip ${id} from the cache, nothing spent.`);
      words[id] = cached.words;
      continue;
    }
    if (sttInput !== null) {
      // The provider sees the clip's id as the file name, as it does for the plain sound.
      sttInput = join(buildDir, "audio", `${id}.isolated.mp3`);
      mkdirSync(dirname(sttInput), { recursive: true });
      copyFileSync(isolated as string, sttInput);
    }
    log(`speech to text (${providers.stt.id}): clip ${id}, ${clip.duration.toFixed(1)} s.`);
    const result = await providers.stt.transcribe({ audio: sttInput ?? getAudio(), language: film.language });
    if (!result.ok) return err(`clip "${id}": ${result.error}`);
    writeTranscript(transcript, result.value.words);
    log(`transcript: clip ${id}, ${result.value.words.length} words, saved ${transcript} (commit it).`);
    words[id] = result.value.words;
  }
  return ok({ kind: "ready", words, speech });
}

/** The cut from the transcripts, written to the EDL file (replacing what is there). */
export function cutFootage(film: FootageFilm, clips: PreparedClip[], words: Record<string, TimedWord[]>, edlPath: string): Edl {
  const edl = buildEdl(
    film.id,
    clips.map((clip) => ({ id: clip.clip.id, role: clip.clip.role, duration: clip.duration, words: words[clip.clip.id] ?? [] })),
    film.cut,
    film.transitions,
  );
  mkdirSync(dirname(edlPath), { recursive: true });
  writeFileSync(edlPath, `${JSON.stringify(edl, null, 2)}\n`);
  return edl;
}

/** The EDL file as written by `cutFootage` or edited by hand, checked against the clips. */
export function readEdlFile(film: FootageFilm, clips: PreparedClip[], edlPath: string): FootageResult<Edl> {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(edlPath, "utf8")) as unknown;
  } catch (error) {
    return err(`${edlPath}: not JSON (${String(error)})`);
  }
  const read = readEdl(json);
  if (!read.ok) return err(`${edlPath}: ${read.error}`);
  const problems = findEdlProblems(read.edl, clips.map((clip) => ({ id: clip.clip.id, duration: clip.duration })), film.id);
  return problems.length > 0 ? err(`${edlPath}: ${problems.join("; ")}`) : ok(read.edl);
}

/**
 * The music file for the cut: a local file as it is, generated music from the cache, or (with `isCommit`) bought
 * from the music provider and cached. Null when the film has none or the rehearsal skips generated music; a paid
 * step when it must be bought and `isCommit` is false.
 */
async function getMusic(film: FootageFilm, edl: Edl, clips: PreparedClip[], seconds: number, options: FootageRunOptions): Promise<FootageResult<string | PaidStep | null>> {
  const source = film.music.source;
  if (source.kind === "none") return ok(null);
  if (source.kind === "file") return existsSync(source.path) ? ok(source.path) : err(`music: no file at ${source.path}`);
  if (options.isPlaceholder) return ok(null);
  const { providers, log } = options;
  let path: string;
  if (source.kind === "prompt") {
    path = getPromptMusicPath(film, options);
  } else {
    const clipKeys: Record<string, string> = {};
    for (const clip of clips) clipKeys[clip.clip.id] = await getClipKey(clip);
    const key = footageCacheKey("music", { segments: edl.segments, clips: clipKeys, description: source.description, tags: source.tags, provider: providers.music.id, model: providers.music.model });
    path = getFootageCachePath(options.cacheDir, film.id, "music", key);
  }
  if (existsSync(path)) {
    log(`music: from the cache ${path}, nothing spent.`);
    return ok(path);
  }
  const step: PaidStep = { kind: "music", item: "film", provider: providers.music.id, seconds };
  if (!options.isCommit) return ok(step);
  log(`music (${providers.music.id}): ${seconds.toFixed(1)} s.`);
  let bought: TtsResult<Buffer>;
  if (source.kind === "prompt") {
    bought = await providers.music.compose({ prompt: source.prompt, seconds });
  } else {
    const preview = join(options.buildDir, "cut-preview.mp4");
    runFfmpeg("The cut preview for Video to Music", buildCutPreviewArgs(edl, Object.fromEntries(clips.map((clip) => [clip.clip.id, clip.file])), preview));
    bought = await providers.music.scoreVideo({ video: preview, description: source.description, tags: source.tags });
  }
  if (!bought.ok) return err(`music: ${bought.error}`);
  writeCacheFile(path, bought.value);
  log(`music: saved ${path} (commit it).`);
  return ok(path);
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
}

export type RenderedFootage = { kind: "dry-run"; steps: PaidStep[] } | { kind: "rendered"; output: string; seconds: number; edlPath: string };

/** Composes the cut and renders it: speech track, ducked music, end card backdrop, assets, hyperframes. */
export async function renderFootage(
  film: FootageFilm,
  clips: PreparedClip[],
  transcript: Extract<TranscribeOutcome, { kind: "ready" }>,
  edl: Edl,
  options: RenderFootageOptions,
): Promise<FootageResult<RenderedFootage>> {
  const { buildDir, log } = options;
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
  runFfmpeg("The speech track", buildSpeechArgs(edl, transcript.speech, join(assetsDir, "speech.mp3")));
  let musicAsset: string | null = null;
  if (typeof music.value === "string") {
    const keyframes = duckingKeyframes(words, { volume: film.music.volume, duckedVolume: film.music.duckedVolume });
    runFfmpeg("The music track", buildMusicArgs({ input: music.value, seconds, keyframes, output: join(assetsDir, "music.mp3") }));
    musicAsset = "assets/music.mp3";
  }
  runFfmpeg("The end card's backdrop", buildLastFrameArgs(edl, clipFiles, join(assetsDir, "last.jpg")));
  const fonts = copyFonts(options.brand.fonts, join(assetsDir, "fonts"));
  if (options.brand.logo !== null) cpSync(options.brand.logo, join(assetsDir, "logo.svg"));
  const sfx: Partial<Record<SfxEvent, string>> = {};
  mkdirSync(join(assetsDir, "sfx"), { recursive: true });
  for (const [event, source] of Object.entries(options.sfx) as [SfxEvent, string][]) {
    const name = `${event}${extname(source)}`;
    cpSync(source, join(assetsDir, "sfx", name));
    sfx[event] = `assets/sfx/${name}`;
  }
  cpSync(require.resolve("gsap/dist/gsap.min.js"), join(assetsDir, "gsap.min.js"));
  const layout = resolveLayout(film.format, options.layout ?? {});
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
      speech: "assets/speech.mp3",
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
  const result = runHyperframes(["render", "--quality", options.quality, "-o", options.output], { cwd: buildDir, stdio: "inherit" });
  if (result.error !== undefined) return err(`hyperframes render did not start: ${result.error.message}.`);
  if (result.status !== 0) return err(`hyperframes render ended with code ${String(result.status)} (signal ${result.signal ?? "-"}).`);
  return ok({ kind: "rendered", output: options.output, seconds, edlPath: getEdlPath(buildDir, options.isPlaceholder) });
}

export interface RenderFootageFilmOptions extends RenderFootageOptions {
  /** Build the EDL again even when the build folder holds one (by default a present EDL, maybe edited by hand, is used). */
  isRecut?: boolean;
}

/**
 * The whole footage film from a `FootageFilm` object, no `marketing.json` needed: prepare, transcribe (or the dry
 * run), cut (reusing an EDL already in the build folder unless `isRecut`), render.
 */
export async function renderFootageFilm(film: FootageFilm, options: RenderFootageFilmOptions): Promise<FootageResult<RenderedFootage>> {
  const clips = await prepareFootage(film, options);
  if (!clips.ok) return clips;
  const transcript = await transcribeFootage(film, clips.value, options);
  if (!transcript.ok) return transcript;
  if (transcript.value.kind === "dry-run") return ok(transcript.value);
  const edlPath = getEdlPath(options.buildDir, options.isPlaceholder);
  let edl: Edl;
  if (existsSync(edlPath) && options.isRecut !== true) {
    const read = readEdlFile(film, clips.value, edlPath);
    if (!read.ok) return read;
    edl = read.value;
    options.log(`cut: ${edlPath} (${edl.segments.length} segments), as it is; softure-marketing footage --step=cut builds it again.`);
  } else {
    edl = cutFootage(film, clips.value, transcript.value.words, edlPath);
    options.log(`cut: ${edl.segments.length} segments written to ${edlPath}.`);
  }
  return renderFootage(film, clips.value, transcript.value, edl, options);
}
