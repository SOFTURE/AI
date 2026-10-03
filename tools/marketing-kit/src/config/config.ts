import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import { MARKETING_LOCALES, type MarketingLocale } from "../messages/index.js";

/**
 * `marketing.config.json`: what the FIRE pipeline used to take from its repository root. Still
 * FIRE-shaped (the `marketing.json` contract replaces it in MK-2); every path in it resolves against
 * the folder of the config file, never against the current directory or a repository.
 */

export const DEFAULT_CONFIG_FILE = "marketing.config.json";

const nonEmpty = z.string().min(1);

const configSchema = z.strictObject({
  /** Language of the film's copy (the persona card, `<html lang>`) and of the post copy. */
  // `MARKETING_LOCALES` lists the dictionaries, so it is never empty.
  locale: z.enum(MARKETING_LOCALES as [MarketingLocale, ...MarketingLocale[]]),
  brand: z.strictObject({
    /** Brand name on the end card. */
    name: nonEmpty,
  }),
  app: z.strictObject({
    /** Where an already running app answers, e.g. `http://localhost:3000`. */
    baseUrl: z.url(),
    /** The page the film records, e.g. `/calculator`. */
    path: z.string().startsWith("/"),
    /** Port of the app the CLI starts itself when `baseUrl` does not answer. */
    port: z.number().int().min(1).max(65535),
    /** Command that starts the app, as arguments (no shell); `{port}` is replaced. Runs in the config folder. */
    startCommand: z.array(nonEmpty).min(1),
  }),
  /** The app's stylesheet the film's colours are read from. */
  siteCss: nonEmpty,
  posts: z.strictObject({
    /** The page the posts link to; each platform's channel code is appended as `?z=`. */
    site: z.url(),
  }),
  paths: z.strictObject({
    /** Film modules: `<films>/<id>.ts`. */
    films: nonEmpty,
    /** Paid voiceover cache (`<key>.mp3` + `<key>.json`); commit it. */
    voiceover: nonEmpty,
    /** Recordings and compositions (`<build>/<id>/`); not committed. */
    build: nonEmpty,
    /** Finished films and post copy (`<out>/<id>/`); not committed. */
    out: nonEmpty,
    /** The project's font files the composition loads (`geist-*.woff2`, `newsreader-*.woff2`). */
    fonts: nonEmpty,
    /** The project's sound effects (`click-soft`, `key-press`, `whoosh`, `sparkle`, `pop` as `.mp3`). */
    sfx: nonEmpty,
  }),
});

export interface MarketingConfig {
  /** Absolute path of the config file and the folder every path resolves against. */
  file: string;
  root: string;
  locale: MarketingLocale;
  brand: { name: string };
  app: {
    /** The recorded page on the already running app. */
    url: string;
    /** The recorded page on the app the CLI starts. */
    ownUrl: string;
    port: number;
    startCommand: string[];
  };
  siteCss: string;
  posts: { site: string };
  paths: { films: string; voiceover: string; build: string; out: string; fonts: string; sfx: string };
}

export type LoadConfigResult = { ok: true; config: MarketingConfig } | { ok: false; error: string };

function formatIssues(file: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => `  ${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`);
  return `${file} is not a valid marketing config:\n${lines.join("\n")}`;
}

/** Reads and validates the config file; paths come back absolute. */
export function loadMarketingConfig(path: string): LoadConfigResult {
  const file = resolve(path);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return { ok: false, error: `Reading the marketing config ${file}: ${(error as NodeJS.ErrnoException).code ?? String(error)}.` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `Reading the marketing config ${file}: not JSON (${error instanceof Error ? error.message : String(error)}).` };
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: formatIssues(file, parsed.error) };
  const data = parsed.data;
  const root = dirname(file);
  const at = (relative: string) => resolve(root, relative);
  return {
    ok: true,
    config: {
      file,
      root,
      locale: data.locale,
      brand: data.brand,
      app: {
        url: new URL(data.app.path, data.app.baseUrl).href,
        ownUrl: `http://localhost:${data.app.port}${data.app.path}`,
        port: data.app.port,
        startCommand: data.app.startCommand.map((part) => part.replaceAll("{port}", String(data.app.port))),
      },
      siteCss: at(data.siteCss),
      posts: data.posts,
      paths: {
        films: at(data.paths.films),
        voiceover: at(data.paths.voiceover),
        build: at(data.paths.build),
        out: at(data.paths.out),
        fonts: at(data.paths.fonts),
        sfx: at(data.paths.sfx),
      },
    },
  };
}
