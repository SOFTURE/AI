import { pathToFileURL } from "node:url";

import { tsImport } from "tsx/esm/api";

import { findMissingFiles, findVideo, formatConfigIssues, type MarketingConfig, type VideoConfig } from "../config/config.js";
import type { Film, Scene } from "../film.js";
import { fail } from "./failure.js";

/** A video from `marketing.json` with its scene module loaded. */
export type LoadedFilm = VideoConfig & Film;

export function listFilms(config: MarketingConfig): string[] {
  return config.videos.map((video) => video.id).sort();
}

function isScene(value: unknown): value is Scene {
  return typeof value === "function";
}

/** The video's entry and its scene (`sceneModule`, TypeScript through tsx), after its files are checked. */
export async function loadFilm(config: MarketingConfig, id: string): Promise<LoadedFilm> {
  const video = findVideo(config, id);
  if (video === null) fail(`no video "${id}" in ${config.file}. Available: ${listFilms(config).join(", ") || "none"}.`);
  const missing = findMissingFiles(config, video);
  if (missing.length > 0) fail(formatConfigIssues(config, missing));
  const imported = (await tsImport(pathToFileURL(video.sceneModule).href, import.meta.url)) as { scene?: unknown };
  if (!isScene(imported.scene)) fail(`videos[${video.index}].sceneModule: ${video.sceneModule} does not export a "scene" function.`);
  return { ...video, scene: imported.scene };
}
