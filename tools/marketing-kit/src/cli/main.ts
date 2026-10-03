#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findMissingFiles, formatConfigIssues, loadMarketingConfig, type MarketingConfig } from "../config/config.js";
import { getGeometry } from "../compose/timeline.js";
import { sceneBeats } from "../film.js";
import { getMarketingMessages } from "../messages/index.js";
import { postsMarkdown } from "../posts/posts.js";
import { recordFilm, ScreenGuardError, type RecordingLog } from "../record/record.js";
import { findMachineProblem } from "../render/preflight.js";
import { runHyperframes } from "../render/hyperframes.js";
import { renderFilm } from "../render/render.js";
import { splitIntoBeats } from "../voice/voiceover.js";
import { CliFailure, fail } from "./failure.js";
import { loadFilm, type LoadedFilm } from "./films.js";
import { writeOgImages } from "./og.js";
import { readOptions, type FilmOptions } from "./options.js";
import { ensureServer } from "./server.js";
import { getVoiceoverPaths, produceVoiceover, readJson, requireVoiceover } from "./voice.js";

/**
 * `softure-marketing`: the only way into the films.
 *
 *   all <film>                 voiceover from the cache -> recording -> render -> post copy
 *   voice <film> [--commit]    voiceover (paid only with --commit)
 *   record <film> [--today=YYYY-MM-DD] [--url=...]
 *   render <film> [--quality=draft|standard|high]
 *   preview <film>
 *   posts <film>
 *   og [image]
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
  const voiceover = requireVoiceover(config, film);
  const voices = splitIntoBeats(voiceover.words, film.beats, film.voice.tempo);
  const server = await ensureServer(config, film, options.url);
  mkdirSync(getBuildDir(config, film), { recursive: true });
  let log: RecordingLog;
  try {
    console.log(`recording: ${server.url} frame by frame; this takes a few minutes.`);
    log = await recordFilm({
      film,
      url: server.url,
      outDir: getBuildDir(config, film),
      voices,
      voiceoverKey: getVoiceoverPaths(config, film).key,
      today: options.today,
      filmPath: film.sceneModule,
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
  const voiceover = requireVoiceover(config, film);
  // The recording must match the script; otherwise the action times belong to another voiceover or
  // other sentences, and the film would come out silently out of sync.
  const beatIds = sceneBeats(film).map((beat) => beat.id);
  if (log.voiceoverKey !== getVoiceoverPaths(config, film).key || log.beatIds?.join(",") !== beatIds.join(",")) {
    fail(`the recording does not match the current script (the sentences or the voiceover changed): run softure-marketing record ${film.id}.`);
  }
  const output = join(getOutDir(config, film), `${film.id}.mp4`);
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
  const { frame } = getGeometry(film.device.viewport);
  console.log(`\n✓ ${output} (${seconds.toFixed(1)} s, ${frame.width}×${frame.height}, ${film.format})`);
  console.log(describePosts(config, film, writePosts(config, film)));
}

function preview(config: MarketingConfig, film: LoadedFilm): void {
  const dir = getBuildDir(config, film);
  if (!existsSync(join(dir, "index.html"))) fail(`no composition: run softure-marketing render ${film.id} first.`);
  const result = runHyperframes(["preview"], { cwd: dir, stdio: "inherit" });
  if (result.status !== 0) fail(`hyperframes preview ended with code ${String(result.status)}.`);
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
  const film = await loadFilm(config, options.filmId);

  switch (options.command) {
    case "voice":
      await produceVoiceover(config, film, options.isCommit);
      return;
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
      if ((await produceVoiceover(config, film, false)) === null) fail("no voiceover; see the message above.");
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
