#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { findMissingFiles, formatConfigIssues, loadMarketingConfig, type MarketingConfig } from "../config/config.js";
import { getGeometry, getLayoutName } from "../compose/timeline.js";
import { sceneBeats } from "../film.js";
import { getMarketingMessages } from "../messages/index.js";
import { postsMarkdown } from "../posts/posts.js";
import { recordFilm, ScreenGuardError, type RecordingLog } from "../record/record.js";
import { findMachineProblem } from "../render/preflight.js";
import { runHyperframes } from "../render/hyperframes.js";
import { renderFilm } from "../render/render.js";
import { takePageScreenshot, takeScreenshots, type ScreenshotBrowser, type ScreenshotEntry, type ScreenshotResult } from "../screenshot/screenshot.js";
import { findStorageStateProblem } from "../screenshot/storage-state.js";
import { isPlaceholderKey } from "../voice/placeholder.js";
import { splitIntoBeats } from "../voice/voiceover.js";
import { CliFailure, fail } from "./failure.js";
import { loadFilm, type LoadedFilm } from "./films.js";
import { writeOgImages } from "./og.js";
import { getRecordingDay, readOptions, type EntryShotsOptions, type FilmOptions, type PageShotsOptions } from "./options.js";
import { ensureServer } from "./server.js";
import { getFilmVoiceover, produceVoiceover, produceVoiceovers, readJson } from "./voice.js";

/**
 * `softure-marketing`: the only way into the films.
 *
 *   all <film> [--placeholder] voiceover from the cache (or the free placeholder) -> recording -> render -> post copy
 *   voice <film>... [--commit] voiceovers in order (paid only with --commit), spaced and stopped at the first error
 *   record <film> [--today=YYYY-MM-DD] [--url=...]   (--today overrides the video's today)
 *   render <film> [--quality=draft|standard|high]
 *   preview <film>
 *   posts <film>
 *   og [image]
 *   shots [<id>] [--url=...]
 *   shots --page=<url> --out=<file.png> --expect=<phrase> [...]
 */

const getBuildDir = (config: MarketingConfig, film: LoadedFilm) => join(config.output.buildDir, film.id);
const getOutDir = (config: MarketingConfig, film: LoadedFilm) => join(config.output.dir, film.id);

function preflight(config: MarketingConfig, film: LoadedFilm, needsRender: boolean): void {
  const problem = findMachineProblem({ needsRender, cwd: config.root });
  if (problem !== null) fail(problem);
  const missing = needsRender ? findMissingFiles(config, film, true) : [];
  if (missing.length > 0) fail(formatConfigIssues(config, missing));
}

async function record(config: MarketingConfig, film: LoadedFilm, options: FilmOptions): Promise<RecordingLog> {
  const { voiceover, key, isPlaceholder } = getFilmVoiceover(config, film, { isPlaceholder: options.isPlaceholder, buildDir: getBuildDir(config, film) });
  if (isPlaceholder) console.log(`voiceover: the placeholder (a tone, ${config.voice.placeholder.wordsPerSecond} words a second); nothing paid, render it with --placeholder.`);
  const voices = splitIntoBeats(voiceover.words, film.beats, film.voice.tempo);
  const server = await ensureServer(config, film, options.url);
  mkdirSync(getBuildDir(config, film), { recursive: true });
  const recordingDay = getRecordingDay(options.today, film.today);
  let log: RecordingLog;
  try {
    console.log(`recording: ${server.url} frame by frame, the app as of ${recordingDay.day ?? "today"} (${recordingDay.source}); this takes a few minutes.`);
    log = await recordFilm({
      film,
      url: server.url,
      outDir: getBuildDir(config, film),
      voices,
      voiceoverKey: key,
      today: recordingDay.day ?? undefined,
      filmPath: film.scenePath,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      browser: {
        colorScheme: config.app.colorScheme,
        locale: config.brand.locale,
        timezone: config.brand.timezone,
        hideSelectors: config.app.hideSelectors,
        screenGuardSelector: config.app.screenGuardSelector,
      },
    });
  } catch (error) {
    if (error instanceof ScreenGuardError) fail(error.message, 2);
    throw error;
  } finally {
    server.stop();
  }
  console.log(`recording: ${log.frames} frames (${(log.frames / log.fps).toFixed(1)} s), screen guard passed.`);
  return log;
}

/** Writes `posts.md`; null when the video has no `social.posts` entry. */
function writePosts(config: MarketingConfig, film: LoadedFilm): string | null {
  if (config.social === null || film.post === null) return null;
  const path = join(getOutDir(config, film), "posts.md");
  mkdirSync(getOutDir(config, film), { recursive: true });
  writeFileSync(
    path,
    postsMarkdown({ title: film.title, post: film.post, linkTemplate: config.social.linkTemplate, messages: getMarketingMessages(config.brand.language) }),
  );
  return path;
}

function describePosts(config: MarketingConfig, film: LoadedFilm, path: string | null): string {
  if (path === null) return `no post copy: social.posts has no entry for "${film.id}" in ${config.file}.`;
  const labels = (film.post?.channels ?? []).map((channel) => getMarketingMessages(config.brand.language).posts.platforms[channel.platform]);
  return `✓ ${path}: post copy for ${labels.join(", ")}`;
}

function render(config: MarketingConfig, film: LoadedFilm, options: FilmOptions): void {
  const dir = getBuildDir(config, film);
  const logPath = join(dir, "log.json");
  if (!existsSync(logPath)) fail(`no recording: run softure-marketing record ${film.id} first.`);
  // Our own file, written by `recordFilm`; the two fields that tie it to the script are checked below.
  const log = readJson(logPath) as RecordingLog;
  // A recording follows the timings of the voiceover it was made on, so a placeholder recording never renders
  // with the paid voiceover, nor the reverse.
  if (isPlaceholderKey(log.voiceoverKey) !== options.isPlaceholder) {
    if (options.isPlaceholder) fail(`the recording was made on the paid voiceover: run softure-marketing record ${film.id} --placeholder, or render without --placeholder.`);
    fail(`the recording was made on the placeholder voiceover: run softure-marketing record ${film.id} for the paid one, or render with --placeholder.`);
  }
  const { voiceover, key } = getFilmVoiceover(config, film, { isPlaceholder: options.isPlaceholder, buildDir: dir });
  // The recording must match the script; otherwise the action times belong to another voiceover or
  // other sentences, and the film would come out silently out of sync.
  const beatIds = sceneBeats(film).map((beat) => beat.id);
  if (log.voiceoverKey !== key || log.beatIds?.join(",") !== beatIds.join(",")) {
    fail(`the recording does not match the current script (the sentences or the voiceover changed): run softure-marketing record ${film.id}${options.isPlaceholder ? " --placeholder" : ""}.`);
  }
  // A rehearsal never takes the place of the real film.
  const output = join(getOutDir(config, film), options.isPlaceholder ? `${film.id}.placeholder.mp4` : `${film.id}.mp4`);
  const seconds = renderFilm({
    film,
    log,
    voices: splitIntoBeats(voiceover.words, film.beats, film.voice.tempo),
    buildDir: dir,
    voiceoverAudio: voiceover.audio,
    fonts: config.brand.fonts,
    logo: config.brand.logo,
    sfx: config.sfx,
    colors: config.brand.colors,
    brandName: config.brand.name,
    locale: config.brand.locale,
    messages: getMarketingMessages(config.brand.language),
    quality: options.quality ?? config.output.quality,
    output,
  });
  const { frame } = getGeometry(film.device.viewport, getLayoutName(film.format, film.device.kind));
  console.log(`\n✓ ${output} (${seconds.toFixed(1)} s, ${frame.width}×${frame.height}, ${film.format})`);
  console.log(describePosts(config, film, writePosts(config, film)));
}

function preview(config: MarketingConfig, film: LoadedFilm): void {
  const dir = getBuildDir(config, film);
  if (!existsSync(join(dir, "index.html"))) fail(`no composition: run softure-marketing render ${film.id} first.`);
  const result = runHyperframes(["preview"], { cwd: dir, stdio: "inherit" });
  if (result.status !== 0) fail(`hyperframes preview ended with code ${String(result.status)}.`);
}

function selectScreenshots(config: MarketingConfig, shotId: string | undefined): [ScreenshotEntry, ...ScreenshotEntry[]] {
  const [first, ...rest] = shotId === undefined ? config.screenshots : config.screenshots.filter((entry) => entry.id === shotId);
  if (first !== undefined) return [first, ...rest];
  if (shotId === undefined) fail(`no screenshots in ${config.file}: add entries to "screenshots".`);
  fail(`no screenshot "${shotId}" in ${config.file}; known: ${config.screenshots.map((entry) => entry.id).join(", ") || "none"}.`);
}

/** The entries with their storage state as an absolute path, each checked before the browser starts. */
function resolveStorageStates(config: MarketingConfig, entries: [ScreenshotEntry, ...ScreenshotEntry[]]): [ScreenshotEntry, ...ScreenshotEntry[]] {
  const [first, ...rest] = entries.map((entry) => {
    if (entry.storageState === undefined) return entry;
    const path = resolve(config.root, entry.storageState);
    const problem = findStorageStateProblem(path);
    if (problem !== null) fail(`screenshot "${entry.id}": ${problem}.`);
    return { ...entry, storageState: path };
  });
  // The map keeps the length of a non-empty tuple.
  return [first as ScreenshotEntry, ...rest];
}

function getScreenshotBrowser(config: MarketingConfig): ScreenshotBrowser {
  return { colorScheme: config.app.colorScheme, locale: config.brand.locale, timezone: config.brand.timezone, hideSelectors: config.app.hideSelectors };
}

/** Prints each result and fails when any shot was refused. */
function reportScreenshots(results: ScreenshotResult[]): void {
  for (const result of results) {
    if (result.ok) console.log(`✓ ${result.file} (${(result.bytes / 1000).toFixed(0)} kB)`);
    else console.error(`✗ ${result.name}: ${result.message}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  if (failed > 0) fail(`${failed} of ${results.length} screenshots failed their gates; see above.`);
}

/** `shots --page`: one page anywhere; the app is not started, and the storage state resolves from the current directory. */
async function pageShot(config: MarketingConfig, options: PageShotsOptions): Promise<void> {
  let { entry } = options;
  if (entry.storageState !== undefined) {
    const path = resolve(entry.storageState);
    const problem = findStorageStateProblem(path);
    if (problem !== null) fail(`--auth: ${problem}.`);
    entry = { ...entry, storageState: path };
  }
  const file = resolve(options.out);
  console.log(`screenshot: ${options.page}.`);
  const result = await takePageScreenshot({
    entry,
    url: options.page,
    file,
    scheme: options.scheme,
    browser: getScreenshotBrowser(config),
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  reportScreenshots([result]);
}

async function shots(config: MarketingConfig, options: EntryShotsOptions): Promise<void> {
  const entries = resolveStorageStates(config, selectScreenshots(config, options.shotId));
  const [first] = entries;
  const target = { url: new URL(first.path, config.app.baseUrl).href, ownUrl: `http://localhost:${config.app.port}${first.path}` };
  const server = await ensureServer(config, target, options.url === undefined ? undefined : new URL(first.path, options.url).href);
  const outDir = join(config.output.dir, "screenshots");
  let results;
  try {
    console.log(`screenshots: ${entries.length} from ${new URL(server.url).origin}.`);
    results = await takeScreenshots({
      entries,
      baseUrl: server.url,
      outDir,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      browser: getScreenshotBrowser(config),
    });
  } finally {
    server.stop();
  }
  reportScreenshots(results);
}

async function main(argv: string[]): Promise<void> {
  const parsed = readOptions(argv);
  if (!parsed.ok) fail(parsed.error);
  const { options } = parsed;
  const loaded = loadMarketingConfig(options.configPath);
  if (!loaded.ok) fail(loaded.error);
  const { config } = loaded;
  if (options.command === "og") {
    await writeOgImages(config, options.imageId);
    return;
  }
  if (options.command === "shots") {
    if (options.mode === "page") await pageShot(config, options);
    else await shots(config, options);
    return;
  }
  if (options.command === "voice") {
    // Every film is loaded before the first paid call, so a typo in the fifth id costs nothing.
    const films: LoadedFilm[] = [];
    for (const id of options.filmIds) films.push(await loadFilm(config, id));
    await produceVoiceovers(config, films, options.isCommit);
    return;
  }
  const film = await loadFilm(config, options.filmId);

  switch (options.command) {
    case "record":
      preflight(config, film, false);
      await record(config, film, options);
      return;
    case "render":
      preflight(config, film, true);
      render(config, film, options);
      return;
    case "preview":
      preflight(config, film, true);
      preview(config, film);
      return;
    case "posts": {
      const path = writePosts(config, film);
      if (path === null) fail(`no post copy for "${film.id}": add an entry with "video": "${film.id}" to social.posts in ${config.file}.`);
      console.log(describePosts(config, film, path));
      return;
    }
    case "all": {
      preflight(config, film, true);
      if (!options.isPlaceholder && (await produceVoiceover(config, film, false)) === null) {
        fail(`no voiceover; see the message above. To rehearse the film for free: softure-marketing all ${film.id} --placeholder.`);
      }
      await record(config, film, options);
      render(config, film, options);
      return;
    }
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliFailure) {
    console.error(`✗ ${error.message}`);
    process.exit(error.exitCode);
  }
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
