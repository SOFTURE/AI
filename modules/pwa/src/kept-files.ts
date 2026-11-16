// The page's side of the kept files: a list of same-origin files (`{ url, sha256, bytes }`, e.g. an entry's documents)
// downloaded into `<app>-<cache>` within a byte budget, so the worker answers them offline (`keptFiles` in the worker's
// options). The cache's name carries no build, so a new build keeps it; it is registered for sign-out through
// `registerDeviceData`. Browser globals are read only when a function runs, so this file is safe to import on the server.
import { registerDeviceData } from "./device-data.js";

/** One file to keep: its same-origin URL, its SHA-256 (64 hex characters) and its size in bytes. */
export interface KeptFile {
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

/** Why a file of the list is not kept after a sync. */
export type KeptFileSkipReason =
  /** Keeping it would pass `budgetBytes` (the list's earlier files come first). */
  | "over_budget"
  /** The download failed: no network, a status other than 200, a redirect. */
  | "failed"
  /** The bytes that arrived do not have the listed SHA-256 or size. */
  | "checksum_mismatch";

export interface KeptFilesSync {
  /** The URLs kept after the sync, in the list's order. */
  readonly kept: readonly string[];
  /** The bytes of every kept file. */
  readonly bytesKept: number;
  /** The URLs downloaded by this sync (new, or replaced by a new `sha256`). */
  readonly downloaded: readonly string[];
  /** The URLs dropped by this sync: gone from the list, replaced, or no longer within the budget. */
  readonly removed: readonly string[];
  readonly skipped: readonly { readonly url: string; readonly reason: KeptFileSkipReason }[];
}

export interface KeptFilesUsage {
  readonly files: number;
  readonly bytes: number;
}

export interface KeptFilesOptions {
  /** The app's prefix, as in the worker's options (`app`). */
  readonly app: string;
  /** The cache's name after the prefix, as in the worker's `keptFiles.cache`. */
  readonly cache: string;
  /** The most bytes kept; the list's order decides what fits. */
  readonly budgetBytes: number;
}

/** The browser APIs the kept files use; each defaults to the global. */
export interface KeptFilesDependencies {
  readonly caches?: Pick<CacheStorage, "open">;
  readonly fetch?: (input: string, init: RequestInit) => Promise<Response>;
  /** The SHA-256 of the bytes, as 64 lowercase hex characters. */
  readonly digest?: (bytes: ArrayBuffer) => Promise<string>;
  /** The page's origin, against which relative URLs resolve. */
  readonly origin?: string;
}

export interface KeptFiles {
  /** `<app>-<cache>`, the Cache Storage name. */
  readonly cacheName: string;
  /**
   * Makes the cache hold exactly the listed files that fit: downloads what is missing or has a new `sha256`, drops what
   * left the list or no longer fits. Syncs run one at a time, in call order. Rejects only when the Cache API itself
   * fails; a file that cannot be downloaded is `skipped`.
   */
  sync(files: readonly KeptFile[]): Promise<KeptFilesSync>;
  /** The kept copy of `url` as a `Blob` with its media type, or `null` when it is not kept. */
  find(url: string): Promise<Blob | null>;
  /** How many files and bytes are kept now. */
  getUsage(): Promise<KeptFilesUsage>;
  /** Stops clearing the cache on sign-out (the registration `createKeptFiles` made). */
  readonly unregister: () => void;
}

/** The response headers that carry a kept file's hash and size, read back by the next sync. */
export const KEPT_SHA256_HEADER = "x-kept-sha256";
export const KEPT_BYTES_HEADER = "x-kept-bytes";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** The Cache Storage name of the kept files, `<app>-<cache>`, the same as the worker's. */
export function getKeptFilesCacheName(app: string, cache: string): string {
  return `${app}-${cache}`;
}

function checkOptions(options: KeptFilesOptions): void {
  if (!NAME_PATTERN.test(options.app)) throw new Error(`createKeptFiles: app ${JSON.stringify(options.app)} must be lowercase letters, digits and dashes`);
  if (!NAME_PATTERN.test(options.cache) || options.cache.startsWith("shell") || options.cache.startsWith("pages")) {
    throw new Error(`createKeptFiles: cache ${JSON.stringify(options.cache)} must be lowercase letters, digits and dashes, not starting with "shell" or "pages"`);
  }
  if (!Number.isSafeInteger(options.budgetBytes) || options.budgetBytes < 0) {
    throw new Error(`createKeptFiles: budgetBytes must be a whole number of 0 or more, got ${String(options.budgetBytes)}`);
  }
}

function checkFile(file: KeptFile): void {
  if (!SHA256_PATTERN.test(file.sha256)) throw new Error(`createKeptFiles: sha256 of ${file.url} must be 64 lowercase hex characters`);
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error(`createKeptFiles: bytes of ${file.url} must be a whole number of 0 or more`);
}

async function digestSha256(bytes: ArrayBuffer): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface KeptEntry {
  readonly sha256: string | null;
  readonly bytes: number;
}

async function readEntries(cache: Cache): Promise<Map<string, KeptEntry>> {
  const entries = new Map<string, KeptEntry>();
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    const bytes = Number(response?.headers.get(KEPT_BYTES_HEADER) ?? "0");
    entries.set(request.url, { sha256: response?.headers.get(KEPT_SHA256_HEADER) ?? null, bytes: Number.isFinite(bytes) ? bytes : 0 });
  }
  return entries;
}

/**
 * The kept files of `<app>-<cache>` with a byte budget, registered for sign-out (`clearDeviceData` deletes the cache).
 * Pair it with the worker's `keptFiles: { cache, pathPrefixes }` so the worker answers the kept copies offline.
 */
export function createKeptFiles(options: KeptFilesOptions, dependencies: KeptFilesDependencies = {}): KeptFiles {
  checkOptions(options);
  const cacheName = getKeptFilesCacheName(options.app, options.cache);
  const unregister = registerDeviceData({ caches: [cacheName] });
  const openCache = (): Promise<Cache> => (dependencies.caches ?? globalThis.caches).open(cacheName);
  const fetchFile = (url: string): Promise<Response> =>
    (dependencies.fetch ?? ((input: string, init: RequestInit) => globalThis.fetch(input, init)))(url, { credentials: "same-origin", cache: "no-store", redirect: "error" });
  const digest = dependencies.digest ?? digestSha256;
  const toUrl = (url: string): string => new URL(url, dependencies.origin ?? globalThis.location.origin).href;
  let queue: Promise<unknown> = Promise.resolve();

  async function download(cache: Cache, url: string, file: KeptFile): Promise<KeptFileSkipReason | null> {
    let response: Response;
    try {
      response = await fetchFile(url);
    } catch {
      return "failed";
    }
    if (response.status !== 200 || response.redirected) return "failed";
    let body: ArrayBuffer;
    try {
      body = await response.arrayBuffer();
    } catch {
      return "failed";
    }
    if (body.byteLength !== file.bytes || (await digest(body)) !== file.sha256) return "checksum_mismatch";
    const headers = new Headers({
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-length": String(body.byteLength),
      [KEPT_SHA256_HEADER]: file.sha256,
      [KEPT_BYTES_HEADER]: String(body.byteLength),
    });
    await cache.put(url, new Response(body, { status: 200, headers }));
    return null;
  }

  async function runSync(files: readonly KeptFile[]): Promise<KeptFilesSync> {
    for (const file of files) checkFile(file);
    const cache = await openCache();
    const entries = await readEntries(cache);
    const wanted = new Map<string, KeptFile>();
    for (const file of files) {
      const url = toUrl(file.url);
      if (!wanted.has(url)) wanted.set(url, file);
    }
    const removed: string[] = [];
    for (const url of entries.keys()) {
      if (wanted.has(url)) continue;
      await cache.delete(url);
      removed.push(url);
    }
    const kept: string[] = [];
    const downloaded: string[] = [];
    const skipped: { url: string; reason: KeptFileSkipReason }[] = [];
    let bytesKept = 0;
    for (const [url, file] of wanted) {
      const entry = entries.get(url);
      const isCurrent = entry !== undefined && entry.sha256 === file.sha256;
      if (bytesKept + file.bytes > options.budgetBytes) {
        if (entry !== undefined) {
          await cache.delete(url);
          removed.push(url);
        }
        skipped.push({ url, reason: "over_budget" });
        continue;
      }
      if (!isCurrent) {
        // A stale copy (another hash) goes first: a failed download must not leave the old document looking current.
        if (entry !== undefined) {
          await cache.delete(url);
          removed.push(url);
        }
        const reason = await download(cache, url, file);
        if (reason !== null) {
          skipped.push({ url, reason });
          continue;
        }
        downloaded.push(url);
      }
      kept.push(url);
      bytesKept += file.bytes;
    }
    return { kept, bytesKept, downloaded, removed, skipped };
  }

  return {
    cacheName,
    sync(files) {
      const run = queue.then(() => runSync(files));
      queue = run.catch(() => undefined);
      return run;
    },
    async find(url) {
      const cache = await openCache();
      const response = await cache.match(toUrl(url));
      return response === undefined ? null : response.blob();
    },
    async getUsage() {
      const entries = await readEntries(await openCache());
      return { files: entries.size, bytes: [...entries.values()].reduce((sum, entry) => sum + entry.bytes, 0) };
    },
    unregister,
  };
}
