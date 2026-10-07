import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getLayoutName } from "../compose/timeline.js";
import type { Device, FilmScript } from "../film.js";
import type { MarketingLocale } from "../messages/index.js";
import { DEFAULT_LINK_IN_BIO, PLATFORMS, type Platform } from "../platforms.js";
import type { PlaceholderPace } from "../voice/placeholder.js";
import type { SceneAction } from "./actions-schema.js";
import { resolveBrandColors } from "./brand.js";
import type { BrandColors, ColorTheme } from "./colors.js";
import { expandUnionIssues, formatIssues, type ConfigIssue } from "./issues.js";
import { SFX_EVENTS, marketingSchema, type MarketingJson, type Quality, type SfxEvent } from "./schema.js";

/**
 * `marketing.json`, loaded: validated by the schema, every path absolute (resolved against the
 * config file's folder, never the current directory), brand colours resolved and per-video settings
 * merged with the defaults of `app` and `voice`.
 */

export { DEFAULT_CONFIG_FILE } from "./schema.js";

export interface FontFile {
  path: string;
  /** A weight or a range, as CSS writes it (`400`, `100 900`). */
  weight: string;
  style: "normal" | "italic";
  unicodeRange: string | null;
}

export interface BrandFont {
  family: string;
  fallback: string;
  files: FontFile[];
}

export interface PlatformChannel {
  platform: Platform;
  code: string;
  linkInBio: boolean;
}

export interface VideoPost {
  caption: string;
  /** `social.disclosure` with the persona's name; null or absent when none is configured or the post opts out. */
  disclosure?: string | null;
  hashtags: string[];
  /** The configured platforms in `PLATFORMS` order, with this video's codes. */
  channels: PlatformChannel[];
}

/** A sentence the scene records, with its actions; `index` is its position in `videos[].beats`. */
export interface ActionBeat {
  id: string;
  index: number;
  /** Seconds held after the sentence; null for the Director's default. */
  pad: number | null;
  actions: SceneAction[];
}

/** Where a video's scene comes from: a TS module, or the beats' `actions`. */
export type SceneSource = { kind: "module"; path: string } | { kind: "actions"; beats: ActionBeat[] };

export interface VideoConfig extends FilmScript {
  /** The entry's position in `videos`, for errors about it. */
  index: number;
  /** The recorded page on the already running app, and on the app the CLI starts. */
  url: string;
  ownUrl: string;
  sceneSource: SceneSource;
  /** The post copy, or null when `social.posts` has no entry for this video. */
  post: VideoPost | null;
  /** `videos[].today`: the day the app is recorded as of, or null for the day of the run. */
  today: string | null;
}

export interface MarketingConfig {
  /** Absolute path of the config file and the folder every path resolves against. */
  file: string;
  root: string;
  brand: {
    name: string;
    /** BCP 47, e.g. `en-US`. */
    locale: string;
    /** The dictionary of the copy: the locale's language. */
    language: MarketingLocale;
    timezone: string;
    logo: string | null;
    colors: BrandColors;
    fonts: { heading: BrandFont | null; body: BrandFont | null };
  };
  app: {
    baseUrl: string;
    port: number;
    startCommand: string[];
    colorScheme: ColorTheme;
    hideSelectors: string[];
    screenGuardSelector: string;
  };
  voice: { provider: "elevenlabs"; cacheDir: string; minIntervalSeconds: number; placeholder: PlaceholderPace };
  videos: VideoConfig[];
  social: { linkTemplate: string } | null;
  screenshots: MarketingJson["screenshots"];
  ogImages: MarketingJson["ogImages"];
  sfx: Partial<Record<SfxEvent, string>>;
  output: { dir: string; buildDir: string; quality: Quality };
}

export type LoadConfigResult = { ok: true; config: MarketingConfig } | { ok: false; error: string };

function resolveFont(font: MarketingJson["brand"]["fonts"]["body"], at: (relative: string) => string): BrandFont | null {
  if (font === undefined) return null;
  return {
    family: font.family,
    fallback: font.fallback,
    files: font.files.map((file) => ({ path: at(file.path), weight: String(file.weight), style: file.style, unicodeRange: file.unicodeRange ?? null })),
  };
}

function resolveDevice(device: MarketingJson["app"]["device"]): Device {
  const viewport = { width: device.viewport[0], height: device.viewport[1] };
  // The schema refuses `mobile: true` on a desktop; a phone is a mobile browser unless it says otherwise.
  if (device.kind === "desktop") return { kind: "desktop", viewport, scale: device.scale };
  return { kind: "phone", viewport, scale: device.scale, isMobile: device.mobile ?? true };
}

function resolveVideos(data: MarketingJson, at: (relative: string) => string): VideoConfig[] {
  const posts = new Map((data.social?.posts ?? []).map((post) => [post.video, post]));
  return data.videos.map((video, index) => {
    const device = video.device ?? data.app.device;
    const post = posts.get(video.id);
    const platforms = data.social?.platforms ?? {};
    return {
      index,
      id: video.id,
      title: video.title,
      path: video.path,
      format: video.format,
      layout: data.layout?.[getLayoutName(video.format, device.kind)] ?? {},
      device: resolveDevice(device),
      persona: video.persona,
      voice: {
        voiceId: video.voice?.voiceId ?? data.voice.voiceId,
        modelId: video.voice?.model ?? data.voice.model,
        language: data.voice.language,
        tempo: video.voice?.tempo ?? data.voice.tempo,
      },
      beats: video.beats.map((beat) => ({ id: beat.id, text: beat.text })),
      hook: video.hook,
      screenGuard: video.screenGuard,
      today: video.today ?? null,
      endCard: video.endCard,
      url: new URL(video.path, data.app.baseUrl).href,
      ownUrl: `http://localhost:${data.app.port}${video.path}`,
      sceneSource:
        video.sceneModule === undefined
          ? {
              kind: "actions",
              // The schema requires actions on every beat after the opening when there is no module.
              beats: video.beats.slice(1).map((beat, offset) => ({ id: beat.id, index: offset + 1, pad: beat.pad ?? null, actions: beat.actions ?? [] })),
            }
          : { kind: "module", path: at(video.sceneModule) },
      post:
        post === undefined
          ? null
          : {
              caption: post.caption,
              disclosure:
                post.disclosure && data.social?.disclosure !== undefined ? data.social.disclosure.replaceAll("{persona}", video.persona.name).trim() : null,
              hashtags: post.hashtags,
              channels: PLATFORMS.flatMap((platform) => {
                const channel = platforms[platform];
                if (channel === undefined) return [];
                return [{ platform, code: post.codes?.[platform] ?? channel.code, linkInBio: channel.linkInBio ?? DEFAULT_LINK_IN_BIO[platform] }];
              }),
            },
    };
  });
}

/** Reads and validates `marketing.json`; every problem comes back at once, by JSON path. */
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
  const parsed = marketingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: formatIssues(file, expandUnionIssues(parsed.error.issues)) };
  const data = parsed.data;
  const root = dirname(file);
  const at = (relative: string) => resolve(root, relative);
  const colors = resolveBrandColors(data.brand, root);
  if (!colors.ok) return { ok: false, error: formatIssues(file, colors.issues) };
  return {
    ok: true,
    config: {
      file,
      root,
      brand: {
        name: data.brand.name,
        locale: data.brand.locale,
        // The schema refuses a locale whose language has no dictionary.
        language: data.brand.locale.split("-")[0] as MarketingLocale,
        timezone: data.brand.timezone,
        logo: data.brand.logo === undefined ? null : at(data.brand.logo.svg),
        colors: colors.colors,
        fonts: { heading: resolveFont(data.brand.fonts.heading, at), body: resolveFont(data.brand.fonts.body, at) },
      },
      app: {
        baseUrl: data.app.baseUrl,
        port: data.app.port,
        startCommand: data.app.startCommand.map((part) => part.replaceAll("{port}", String(data.app.port))),
        colorScheme: data.app.colorScheme,
        hideSelectors: data.app.hideSelectors,
        screenGuardSelector: data.app.screenGuardSelector,
      },
      voice: { provider: data.voice.provider, cacheDir: at(data.voice.cacheDir), minIntervalSeconds: data.voice.minIntervalSeconds, placeholder: data.voice.placeholder },
      videos: resolveVideos(data, at),
      social: data.social === undefined ? null : { linkTemplate: data.social.linkTemplate },
      screenshots: data.screenshots,
      ogImages: data.ogImages,
      sfx: Object.fromEntries(SFX_EVENTS.flatMap((event) => (data.sfx[event] === undefined ? [] : [[event, at(data.sfx[event])]]))),
      output: { dir: at(data.output.dir), buildDir: at(data.output.buildDir), quality: data.output.quality },
    },
  };
}

/** Finds a video by id; null when the config has none. */
export function findVideo(config: MarketingConfig, id: string): VideoConfig | null {
  return config.videos.find((video) => video.id === id) ?? null;
}

/**
 * Files the pipeline reads, checked before anything slow starts: the scene module (if any) always, and with
 * `isRendering` the logo, the fonts and the sound effects too. Returns the problems by JSON path.
 */
export function findMissingFiles(config: MarketingConfig, video: VideoConfig, isRendering: boolean): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const check = (path: PropertyKey[], file: string) => {
    if (!existsSync(file)) issues.push({ path, message: `no file at ${file}` });
  };
  if (video.sceneSource.kind === "module") check(["videos", video.index, "sceneModule"], video.sceneSource.path);
  if (!isRendering) return issues;
  if (config.brand.logo !== null) check(["brand", "logo", "svg"], config.brand.logo);
  for (const kind of ["heading", "body"] as const) {
    config.brand.fonts[kind]?.files.forEach((font, index) => check(["brand", "fonts", kind, "files", index, "path"], font.path));
  }
  for (const event of SFX_EVENTS) {
    const sound = config.sfx[event];
    if (sound !== undefined) check(["sfx", event], sound);
  }
  return issues;
}

/** Problems found after loading, in the same format as the load errors. */
export function formatConfigIssues(config: MarketingConfig, issues: readonly ConfigIssue[]): string {
  return formatIssues(config.file, issues);
}
