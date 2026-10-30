import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findFootage, findMissingFootageFiles, formatConfigIssues, type FootageConfig, type MarketingConfig } from "../config/config.js";
import { createElevenLabsFootageProviders } from "../footage/elevenlabs.js";
import { cutFootage, getEdlPath, prepareFootage, readEdlFile, renderFootage, transcribeFootage, type RenderFootageOptions } from "../footage/pipeline.js";
import { checkFootageTools } from "../footage/tools.js";
import { postsMarkdown } from "../posts/posts.js";
import { fail } from "./failure.js";
import type { FootageOptions } from "./options.js";

/**
 * `softure-marketing footage <film>`: a footage film from `marketing.json` (`footage[]`). Without `--step` it runs
 * transcribe, cut (keeping an EDL already in the build folder, maybe edited by hand) and render; `--step=transcribe`
 * stops after the transcripts, `--step=cut` writes the EDL afresh from them, `--step=render` renders the EDL as it is.
 */

function getRunOptions(config: MarketingConfig, film: FootageConfig, options: FootageOptions): RenderFootageOptions {
  const outDir = join(config.output.dir, film.id);
  return {
    buildDir: join(config.output.buildDir, film.id),
    cacheDir: config.voice.cacheDir,
    providers: createElevenLabsFootageProviders(process.env),
    isCommit: options.isCommit,
    isPlaceholder: options.isPlaceholder,
    log: (line) => console.log(line),
    brand: { name: config.brand.name, locale: config.brand.locale, colors: config.brand.colors, fonts: config.brand.fonts, logo: config.brand.logo },
    sfx: config.sfx,
    quality: options.quality ?? config.output.quality,
    // A rehearsal never takes the place of the real film.
    output: join(outDir, options.isPlaceholder ? `${film.id}.placeholder.mp4` : `${film.id}.mp4`),
    layout: film.layout,
  };
}

/** Writes `posts.md` for a footage film; null when `social.posts` has no entry for it. */
export function writeFootagePosts(config: MarketingConfig, film: FootageConfig): string | null {
  if (config.social === null || film.post === null) return null;
  const dir = join(config.output.dir, film.id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "posts.md");
  writeFileSync(path, postsMarkdown({ title: film.title, post: film.post, linkTemplate: config.social.linkTemplate, messages: config.brand.messages }));
  return path;
}

export async function runFootage(config: MarketingConfig, options: FootageOptions): Promise<void> {
  const film = findFootage(config, options.filmId);
  if (film === null) fail(`no footage film "${options.filmId}" in ${config.file}. Available: ${config.footage.map((entry) => entry.id).join(", ") || "none"}.`);
  const needsRender = options.step === "all" || options.step === "render";
  // On a developer's machine hyperframes' first render downloads its browser; a worker image is checked without that.
  const problems = await checkFootageTools({ needsRender, isBrowserDownloadAllowed: true });
  if (problems.length > 0) fail(problems.join("\n"));
  const missing = findMissingFootageFiles(config, film, needsRender);
  if (missing.length > 0) fail(formatConfigIssues(config, missing));
  const run = getRunOptions(config, film, options);
  if (options.isPlaceholder) console.log("footage: rehearsal on placeholder transcripts (each clip's script); nothing paid, no isolation, no generated music.");

  const clips = await prepareFootage(film, run);
  if (!clips.ok) fail(clips.error);
  const transcript = await transcribeFootage(film, clips.value, run);
  if (!transcript.ok) fail(transcript.error);
  if (transcript.value.kind === "dry-run") return;
  if (options.step === "transcribe") {
    console.log(`✓ transcripts of ${clips.value.length} clips ready; next: softure-marketing footage ${film.id} --step=cut${options.isPlaceholder ? " --placeholder" : ""}.`);
    return;
  }
  const edlPath = getEdlPath(run.buildDir, options.isPlaceholder);
  const isRecut = options.step === "cut" || (options.step === "all" && !existsSync(edlPath));
  let edl;
  if (isRecut) {
    edl = cutFootage(film, clips.value, transcript.value.words, edlPath);
    console.log(`cut: ${edl.segments.length} segments written to ${edlPath}; check or edit it, then softure-marketing footage ${film.id} --step=render.`);
    if (options.step === "cut") return;
  } else {
    if (!existsSync(edlPath)) fail(`no EDL at ${edlPath}: run softure-marketing footage ${film.id} --step=cut first.`);
    const read = readEdlFile(film, clips.value, edlPath);
    if (!read.ok) fail(read.error);
    edl = read.value;
    console.log(`cut: ${edlPath} (${edl.segments.length} segments), as it is; --step=cut builds it again.`);
  }
  const rendered = await renderFootage(film, clips.value, transcript.value, edl, run);
  if (!rendered.ok) fail(rendered.error);
  if (rendered.value.kind === "dry-run") return;
  const { output, seconds, bytes, width, height, durationSeconds, cover } = rendered.value;
  console.log(`\n✓ ${output} (${seconds.toFixed(1)} s, ${film.format})`);
  console.log(`  ${width}×${height}, ${durationSeconds.toFixed(2)} s, ${(bytes / 1_000_000).toFixed(1)} MB, H.264 High, AAC 48 kHz stereo, fast start`);
  if (cover !== null) console.log(`✓ ${cover}: cover`);
  const posts = writeFootagePosts(config, film);
  console.log(posts === null ? `no post copy: social.posts has no entry for "${film.id}" in ${config.file}.` : `✓ ${posts}: post copy`);
}
