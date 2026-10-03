import { pathToFileURL } from "node:url";

import { tsImport } from "tsx/esm/api";

import { findMissingFiles, findVideo, formatConfigIssues, type MarketingConfig, type VideoConfig } from "../config/config.js";
import type { Film, Scene } from "../film.js";
import { createActionScene } from "../record/actions.js";
import { fail } from "./failure.js";

/** A video from `marketing.json` with its scene ready to record. */
export type LoadedFilm = VideoConfig & Film & { scenePath: string };

export function listFilms(config: MarketingConfig): string[] {
  return config.videos.map((video) => video.id).sort();
}

function isScene(value: unknown): value is Scene {
  return typeof value === "function";
}

/**
 * The video's entry and its scene: the beats' `actions`, or `sceneModule` (TypeScript through tsx).
 * `scenePath` is the file to fix when the scene fails: the module, or the config for actions.
 */
export async function loadFilm(config: MarketingConfig, id: string): Promise<LoadedFilm> {
  const video = findVideo(config, id);
  if (video === null) fail(`no video "${id}" in ${config.file}. Available: ${listFilms(config).join(", ") || "none"}.`);
  const missing = findMissingFiles(config, video, false);
  if (missing.length > 0) fail(formatConfigIssues(config, missing));
  const source = video.sceneSource;
  if (source.kind === "actions") return { ...video, scene: createActionScene(source.beats, video.index), scenePath: config.file };
  const imported = (await tsImport(pathToFileURL(source.path).href, import.meta.url)) as { scene?: unknown };
  if (!isScene(imported.scene)) fail(`videos[${video.index}].sceneModule: ${source.path} does not export a "scene" function.`);
  return { ...video, scene: imported.scene, scenePath: source.path };
}
