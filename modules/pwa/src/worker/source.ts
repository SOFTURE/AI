import { SERVICE_WORKER_PATH } from "../paths.js";
import { serviceWorker, type ExtraOrigin, type ServiceWorkerConfig } from "./service-worker.js";

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

export const DEFAULT_MAX_PAGES = 60;

const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface ExtraOriginOptions {
  readonly origin: string;
  readonly cache: string;
  /** No cap by default. */
  readonly maxEntries?: number;
}

export interface ServiceWorkerOptions {
  /** The cache names' prefix, e.g. the app's slug: lowercase letters, digits and dashes. */
  readonly app: string;
  /** The page shown offline, e.g. `/offline`; it must render without a session. */
  readonly offlinePath: string;
  /** Replaces `DEFAULT_EXCLUDED_PREFIXES` (spread it to extend); the worker's own path is always excluded. */
  readonly excludedPrefixes?: readonly string[];
  /** Replaces `DEFAULT_STATIC_PREFIXES`. */
  readonly staticPrefixes?: readonly string[];
  /** 5 s by default. */
  readonly navigationTimeoutMs?: number;
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
    cache: options.cache,
    maxEntries: options.maxEntries === undefined ? null : checkPositiveInteger("extraOrigins[].maxEntries", options.maxEntries),
  };
}

/** The worker's JSON config: the options with their defaults, checked, for this build. */
export function resolveServiceWorkerConfig(options: ServiceWorkerOptions, build: string): ServiceWorkerConfig {
  if (!APP_NAME_PATTERN.test(options.app)) {
    throw new Error(`resolveServiceWorkerConfig: app ${JSON.stringify(options.app)} must be lowercase letters, digits and dashes`);
  }
  if (!options.offlinePath.startsWith("/")) {
    throw new Error(`resolveServiceWorkerConfig: offlinePath ${JSON.stringify(options.offlinePath)} must start with /`);
  }
  const excludedPrefixes = options.excludedPrefixes ?? DEFAULT_EXCLUDED_PREFIXES;
  return {
    app: options.app,
    build,
    offlinePath: options.offlinePath,
    excludedPrefixes: excludedPrefixes.includes(SERVICE_WORKER_PATH) ? [...excludedPrefixes] : [...excludedPrefixes, SERVICE_WORKER_PATH],
    staticPrefixes: [...(options.staticPrefixes ?? DEFAULT_STATIC_PREFIXES)],
    navigationTimeoutMs: checkPositiveInteger("navigationTimeoutMs", options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS),
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
