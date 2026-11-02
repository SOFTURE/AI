import { SERVICE_WORKER_PATH } from "../paths.js";
import {
  serviceWorker,
  type ExtraOrigin,
  type ExtraOriginCacheKey,
  type ExtraOriginStrategy,
  type ServiceWorkerConfig,
} from "./service-worker.js";

/** The paths the worker never touches by default: APIs, sign-in flows and the account pages, the CDN's own paths. */
export const DEFAULT_EXCLUDED_PREFIXES: readonly string[] = [
  "/api/",
  "/oauth/",
  "/.well-known/",
  "/cdn-cgi/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/account",
];

/** Immutable files kept on first use: Next's hashed build output and the package's icons. */
export const DEFAULT_STATIC_PREFIXES: readonly string[] = ["/_next/static/", "/pwa/icons/"];

export const DEFAULT_NAVIGATION_TIMEOUT_MS = 5_000;

export const DEFAULT_NAVIGATION_MAX_WAIT_MS = 12_000;

export const DEFAULT_ASSET_TIMEOUT_MS = 10_000;

export const DEFAULT_MAX_PAGES = 60;

/** A `network-first` extra origin's head start before its kept copy answers. */
export const DEFAULT_EXTRA_ORIGIN_TIMEOUT_MS = 5_000;

const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

interface ExtraOriginBaseOptions {
  readonly origin: string;
  /**
   * The paths this entry serves, e.g. `["/styles/", "/fonts/"]`; every path by default. Several entries may name one
   * origin: the first whose paths match serves the request, and a path no entry names goes to the network untouched.
   */
  readonly pathPrefixes?: readonly string[];
  readonly cache: string;
  /** No cap by default. */
  readonly maxEntries?: number;
  /**
   * The cache key rule: a regular expression on the path and its replacement, e.g.
   * `{ pattern: "^/planet/[^/]+/", replacement: "/planet/" }` drops a tile host's build segment. The URL itself by default.
   */
  readonly cacheKey?: ExtraOriginCacheKey;
  /** `true` by default; `false` never stores what the worker fetches, so the cache holds only what the page put there. */
  readonly store?: boolean;
}

/** An extra origin: kept copy first (the default), or network first within `timeoutMs` for files that change. */
export type ExtraOriginOptions = ExtraOriginBaseOptions &
  ({ readonly strategy?: "cache-first" } | { readonly strategy: "network-first"; /** 5 s by default. */ readonly timeoutMs?: number });

export interface ServiceWorkerOptions {
  /** The cache names' prefix, e.g. the app's slug: lowercase letters, digits and dashes. */
  readonly app: string;
  /** The page shown offline, e.g. `/offline`; it must render without a session. */
  readonly offlinePath: string;
  /** Replaces `DEFAULT_EXCLUDED_PREFIXES` (spread it to extend); the worker's own path is always excluded. */
  readonly excludedPrefixes?: readonly string[];
  /** Replaces `DEFAULT_STATIC_PREFIXES`. */
  readonly staticPrefixes?: readonly string[];
  /**
   * The installed app's start page (the manifest's `start_url`, e.g. `/`): kept at install in the new build's pages, so
   * the first cold start after a deploy opens offline. None by default.
   */
  readonly startPath?: string;
  /** 5 s by default. */
  readonly navigationTimeoutMs?: number;
  /** With no kept page, the longest wait before the offline page: 12 s by default, at least `navigationTimeoutMs`. */
  readonly navigationMaxWaitMs?: number;
  /** The longest wait for a file not kept before it fails: 10 s by default. */
  readonly assetTimeoutMs?: number;
  /** 60 by default. */
  readonly maxPages?: number;
  /** Other origins kept in their own cache (map tiles); none by default. */
  readonly extraOrigins?: readonly ExtraOriginOptions[];
}

function checkPositiveInteger(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`resolveServiceWorkerConfig: ${name} must be a positive integer, got ${value}`);
  }
  return value;
}

function readOrigin(value: string): string {
  if (!URL.canParse(value)) throw new Error(`resolveServiceWorkerConfig: extra origin ${JSON.stringify(value)} is not a URL`);
  return new URL(value).origin;
}

function resolveExtraOriginStrategy(options: ExtraOriginOptions): ExtraOriginStrategy {
  if (options.strategy === "network-first") {
    return { kind: "network-first", timeoutMs: checkPositiveInteger("extraOrigins[].timeoutMs", options.timeoutMs ?? DEFAULT_EXTRA_ORIGIN_TIMEOUT_MS) };
  }
  // Typed out for cache-first, but a JavaScript caller or a cast can still pass them.
  const loose = options as { readonly strategy?: unknown; readonly timeoutMs?: unknown };
  if (loose.strategy !== undefined && loose.strategy !== "cache-first") {
    throw new Error(`resolveServiceWorkerConfig: extra origin strategy ${JSON.stringify(loose.strategy)} must be "cache-first" or "network-first"`);
  }
  if (loose.timeoutMs !== undefined) {
    throw new Error("resolveServiceWorkerConfig: extraOrigins[].timeoutMs applies only to the network-first strategy");
  }
  return { kind: "cache-first" };
}

function resolveCacheKey(cacheKey: ExtraOriginCacheKey | undefined): ExtraOriginCacheKey | null {
  if (cacheKey === undefined) return null;
  try {
    new RegExp(cacheKey.pattern);
  } catch {
    throw new Error(`resolveServiceWorkerConfig: extra origin cacheKey pattern ${JSON.stringify(cacheKey.pattern)} is not a regular expression`);
  }
  return { pattern: cacheKey.pattern, replacement: cacheKey.replacement };
}

function resolvePathPrefixes(prefixes: readonly string[] | undefined): readonly string[] | null {
  if (prefixes === undefined) return null;
  if (prefixes.length === 0) throw new Error("resolveServiceWorkerConfig: extraOrigins[].pathPrefixes must name at least one path");
  for (const prefix of prefixes) {
    if (!prefix.startsWith("/")) throw new Error(`resolveServiceWorkerConfig: extra origin path prefix ${JSON.stringify(prefix)} must start with /`);
  }
  return [...prefixes];
}

function resolveExtraOrigin(options: ExtraOriginOptions): ExtraOrigin {
  if (!APP_NAME_PATTERN.test(options.cache)) {
    throw new Error(`resolveServiceWorkerConfig: extra origin cache ${JSON.stringify(options.cache)} must be lowercase letters, digits and dashes`);
  }
  // `shell` and `pages` would collide with the build caches that activate drops.
  if (options.cache.startsWith("shell") || options.cache.startsWith("pages")) {
    throw new Error(`resolveServiceWorkerConfig: extra origin cache ${JSON.stringify(options.cache)} must not start with "shell" or "pages"`);
  }
  return {
    origin: readOrigin(options.origin),
    pathPrefixes: resolvePathPrefixes(options.pathPrefixes),
    cache: options.cache,
    maxEntries: options.maxEntries === undefined ? null : checkPositiveInteger("extraOrigins[].maxEntries", options.maxEntries),
    strategy: resolveExtraOriginStrategy(options),
    cacheKey: resolveCacheKey(options.cacheKey),
    store: options.store ?? true,
  };
}

/** The Cache Storage name of an extra origin's cache, `<app>-<cache>`, for a page that fills it ahead of time. */
export function getExtraOriginCacheName(app: string, cache: string): string {
  return `${app}-${cache}`;
}

/**
 * The key the worker reads a file under, for a page that downloads an area into the extra origin's cache: the URL
 * itself, or with `cacheKey`, `origin + path.replace(pattern, replacement) + search` (the worker applies the same rule).
 */
export function getExtraOriginCacheKey(url: string, cacheKey?: ExtraOriginCacheKey): string {
  const parsed = new URL(url);
  if (cacheKey === undefined) return parsed.href;
  return `${parsed.origin}${parsed.pathname.replace(new RegExp(cacheKey.pattern), cacheKey.replacement)}${parsed.search}`;
}

/** The worker's JSON config: the options with their defaults, checked, for this build. */
export function resolveServiceWorkerConfig(options: ServiceWorkerOptions, build: string): ServiceWorkerConfig {
  if (!APP_NAME_PATTERN.test(options.app)) {
    throw new Error(`resolveServiceWorkerConfig: app ${JSON.stringify(options.app)} must be lowercase letters, digits and dashes`);
  }
  if (!options.offlinePath.startsWith("/")) {
    throw new Error(`resolveServiceWorkerConfig: offlinePath ${JSON.stringify(options.offlinePath)} must start with /`);
  }
  if (options.startPath !== undefined && !options.startPath.startsWith("/")) {
    throw new Error(`resolveServiceWorkerConfig: startPath ${JSON.stringify(options.startPath)} must start with /`);
  }
  const navigationTimeoutMs = checkPositiveInteger("navigationTimeoutMs", options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS);
  const navigationMaxWaitMs = checkPositiveInteger("navigationMaxWaitMs", options.navigationMaxWaitMs ?? Math.max(DEFAULT_NAVIGATION_MAX_WAIT_MS, navigationTimeoutMs));
  if (navigationMaxWaitMs < navigationTimeoutMs) {
    throw new Error(`resolveServiceWorkerConfig: navigationMaxWaitMs ${navigationMaxWaitMs} must be at least navigationTimeoutMs ${navigationTimeoutMs}`);
  }
  const excludedPrefixes = options.excludedPrefixes ?? DEFAULT_EXCLUDED_PREFIXES;
  return {
    app: options.app,
    build,
    offlinePath: options.offlinePath,
    excludedPrefixes: excludedPrefixes.includes(SERVICE_WORKER_PATH) ? [...excludedPrefixes] : [...excludedPrefixes, SERVICE_WORKER_PATH],
    staticPrefixes: [...(options.staticPrefixes ?? DEFAULT_STATIC_PREFIXES)],
    navigationTimeoutMs,
    navigationMaxWaitMs,
    assetTimeoutMs: checkPositiveInteger("assetTimeoutMs", options.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS),
    startPath: options.startPath ?? null,
    maxPages: checkPositiveInteger("maxPages", options.maxPages ?? DEFAULT_MAX_PAGES),
    extraOrigins: (options.extraOrigins ?? []).map(resolveExtraOrigin),
  };
}

/** The text of `/sw.js`: the worker function called with the browser's `self` and the config. */
export function buildServiceWorkerSource(config: ServiceWorkerConfig): string {
  return [
    `// ${config.app} service worker, build ${config.build} (@softure-ai/pwa)`,
    `"use strict";`,
    `(${serviceWorker.toString()})(self, ${JSON.stringify(config)});`,
    "",
  ].join("\n");
}
