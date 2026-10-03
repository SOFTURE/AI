import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { tsImport } from "tsx/esm/api";

import type { MarketingConfig } from "../config/config.js";
import { validateFilm, type Film } from "../film.js";
import { fail } from "./failure.js";

export function listFilms(config: MarketingConfig): string[] {
  if (!existsSync(config.paths.films)) return [];
  return readdirSync(config.paths.films)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .sort();
}

export function getFilmPath(config: MarketingConfig, id: string): string {
  return join(config.paths.films, `${id}.ts`);
}

/** Imports `<films>/<id>.ts` (TypeScript, through tsx), checks its export and validates the script. */
export async function loadFilm(config: MarketingConfig, id: string): Promise<Film> {
  const path = getFilmPath(config, id);
  if (!existsSync(path)) fail(`no film "${id}" in ${config.paths.films}. Available: ${listFilms(config).join(", ") || "none"}.`);
  const imported = (await tsImport(pathToFileURL(path).href, import.meta.url)) as { film?: Film };
  const film = imported.film;
  if (film === undefined) fail(`${path} does not export "film".`);
  if (film.id !== id) fail(`${path} has id "${film.id}": the id must equal the file name.`);
  validateFilm(film);
  return film;
}
