// The service worker as one self-contained function. `buildServiceWorkerSource` writes its source text into
// `/sw.js` and calls it with the browser's `self` and the JSON config, so it may use only its parameters and the
// worker's globals (`URL`, `Request`, `Response`, `setTimeout`): no imports, no helpers outside its body. Tests call
// it in Node with a fake scope.

/** One extra origin the worker keeps in its own cache, e.g. a map's tile host. */
export interface ExtraOrigin {
  /** The origin, e.g. `https://tiles.example.com`. */
  readonly origin: string;
  /** The cache's name after the app's prefix (`<app>-<cache>`). It carries no build, so it survives a new build. */
  readonly cache: string;
  /** The most entries kept (oldest dropped first), or `null` for no cap. */
  readonly maxEntries: number | null;
}

export interface ServiceWorkerConfig {
  /** The cache names' prefix: `<app>-shell-<build>`, `<app>-pages-<build>`. */
  readonly app: string;
  /** The build's version (`.next/BUILD_ID`). It changes the worker's bytes, so a new build installs a new worker. */
  readonly build: string;
  /** The page shown for a navigation with no network and no kept copy, kept at install. */
  readonly offlinePath: string;
  /** Path prefixes the worker never touches (`/api/`, sign-in pages, the worker itself). */
  readonly excludedPrefixes: readonly string[];
  /** Path prefixes of immutable files served from the shell cache first and kept there (`/_next/static/`). */
  readonly staticPrefixes: readonly string[];
  /** How long a navigation waits for the network before a kept page is shown, in milliseconds. */
  readonly navigationTimeoutMs: number;
  /**
   * The longest a navigation with no kept page waits for the network before the offline page answers, in milliseconds.
   * A network that connects but never answers (no signal, a captive Wi-Fi) is never waited for without limit.
   */
  readonly navigationMaxWaitMs: number;
  /** The longest a file not kept (the shell's or an extra origin's) waits for the network before it fails. */
  readonly assetTimeoutMs: number;
  /**
   * The installed app's start page (the manifest's `start_url`), kept at install in this build's pages with the files
   * it names, so the first cold start after a deploy opens offline; `null` keeps none.
   */
  readonly startPath: string | null;
  /** The most pages kept for offline use; the least recently kept goes first. */
  readonly maxPages: number;
  readonly extraOrigins: readonly ExtraOrigin[];
}

export interface WorkerExtendableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

export interface WorkerFetchEvent extends WorkerExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

export interface WorkerMessageEvent extends WorkerExtendableEvent {
  readonly data: unknown;
}

/** The part of `ServiceWorkerGlobalScope` the worker uses. */
export interface WorkerScope {
  readonly location: { readonly origin: string };
  readonly caches: CacheStorage;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(request: Request): Promise<Response>;
  addEventListener(type: "install" | "activate", listener: (event: WorkerExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
}

/** The messages a page sends the worker: `{ type: "skip-waiting" }` and `{ type: "clear-pages" }`. */
export type ServiceWorkerMessage = { readonly type: "skip-waiting" } | { readonly type: "clear-pages" };

export function serviceWorker(scope: WorkerScope, config: ServiceWorkerConfig): void {
  const origin = scope.location.origin;
  const shellCacheName = `${config.app}-shell-${config.build}`;
  const pagesCacheName = `${config.app}-pages-${config.build}`;
  const buildCachePrefixes = [`${config.app}-shell-`, `${config.app}-pages-`];
  const offlineUrl = new URL(config.offlinePath, origin).href;

  function matchesPrefix(path: string, prefix: string): boolean {
    // `/login` covers `/login` and `/login/…`, never `/logins`; `/api/` covers `/api` too.
    const folder = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return `${path}/`.startsWith(folder);
  }

  function isExcluded(path: string): boolean {
    return config.excludedPrefixes.some((prefix) => matchesPrefix(path, prefix));
  }

  function isStatic(path: string): boolean {
    return config.staticPrefixes.some((prefix) => matchesPrefix(path, prefix));
  }

  // Only a whole same-origin answer is kept: a 200 the browser fetched itself, not redirected, and for a page HTML.
  function isWholeAnswer(response: Response, isPage: boolean): boolean {
    if (response.status !== 200 || response.type !== "basic" || response.redirected) return false;
    return !isPage || (response.headers.get("content-type") ?? "").includes("text/html");
  }

  function readAttribute(tag: string, name: string): string | null {
    const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
    if (match === null) return null;
    return (match[1] ?? match[2] ?? match[3] ?? "").replaceAll("&amp;", "&");
  }

  // The same-origin scripts, styles and icons the offline page's HTML names, so the page renders with no network.
  function findPageAssets(html: string): string[] {
    const urls = new Set<string>();
    for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
      const tag = match[0];
      const isScript = (match[1] ?? "").toLowerCase() === "script";
      const rel = isScript ? "" : (readAttribute(tag, "rel") ?? "").toLowerCase();
      const as = (readAttribute(tag, "as") ?? "").toLowerCase();
      const isAsset =
        isScript ||
        /(^|\s)(stylesheet|icon|apple-touch-icon|modulepreload)(\s|$)/.test(rel) ||
        (/(^|\s)preload(\s|$)/.test(rel) && (as === "script" || as === "style"));
      const value = readAttribute(tag, isScript ? "src" : "href");
      if (!isAsset || value === null || value === "") continue;
      const url = new URL(value, offlineUrl);
      if (url.origin === origin && !isExcluded(url.pathname)) urls.add(url.href);
    }
    return [...urls];
  }

  async function keepShell(): Promise<void> {
    const shell = await scope.caches.open(shellCacheName);
    const page = await scope.fetch(new Request(offlineUrl, { cache: "reload" }));
    if (!isWholeAnswer(page, true)) {
      // A failed install keeps the worker that runs now, which is what an app wants from a broken deploy.
      throw new Error(`service worker install: the offline page ${config.offlinePath} answered ${page.status}`);
    }
    const html = await page.clone().text();
    await shell.put(offlineUrl, page);
    await Promise.all(
      findPageAssets(html).map(async (url) => {
        const asset = await scope.fetch(new Request(url, { cache: "reload" }));
        if (isWholeAnswer(asset, false)) await shell.put(url, asset);
      }),
    );
    if (config.startPath !== null) await keepStartPage(shell, new URL(config.startPath, origin).href);
  }

  // The start page in this build's pages and the files it names in its shell: a new build drops the old build's pages,
  // and the first cold start after a deploy must still open offline. Best effort: signed out (a redirect), an error or
  // an incomplete page keeps nothing and never fails the install, which would leave the device on the old build.
  async function keepStartPage(shell: Cache, url: string): Promise<void> {
    try {
      const page = await scope.fetch(new Request(url, { cache: "reload", credentials: "same-origin" }));
      if (!isWholeAnswer(page, true)) return;
      const html = await page.clone().text();
      if (!isCompletePage(html)) return;
      await Promise.all(
        findPageAssets(html).map(async (asset) => {
          if (await shell.match(asset)) return;
          const response = await scope.fetch(new Request(asset, { cache: "reload" }));
          if (isWholeAnswer(response, false)) await shell.put(asset, response);
        }),
      );
      await keepPage(url, page);
    } catch {
      // The next navigation that the network answers keeps the page instead.
    }
  }

  async function dropOtherBuilds(): Promise<void> {
    const names = await scope.caches.keys();
    const stale = names.filter(
      (name) => name !== shellCacheName && name !== pagesCacheName && buildCachePrefixes.some((prefix) => name.startsWith(prefix)),
    );
    await Promise.all(stale.map((name) => scope.caches.delete(name)));
    await scope.clients.claim();
  }

  async function trimCache(cache: Cache, maxEntries: number): Promise<void> {
    const keys = await cache.keys();
    // Cache keys come back in insertion order, and a kept entry is deleted before it is put again.
    await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
  }

  // A streamed page answers 200 before it knows how it ends: a sign-in redirect in the page arrives as Next's
  // `<meta http-equiv="refresh">`, a failed boundary as React's client-render instruction (`$RX`). Keeping either
  // would replace the good copy, e.g. an expired session would overwrite the offline page with a redirect.
  function isCompletePage(html: string): boolean {
    if (/\$RX\s*=\s*function\s*\(|\$RX\(/.test(html)) return false;
    return !/<meta\b[^>]*\shttp-equiv\s*=\s*["']?refresh["'\s/>]/i.test(html);
  }

  async function keepPage(url: string, response: Response): Promise<void> {
    const html = await response.text();
    if (!isCompletePage(html)) return;
    const pages = await scope.caches.open(pagesCacheName);
    await pages.delete(url);
    await pages.put(url, new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers }));
    await trimCache(pages, config.maxPages);
  }

  async function findOfflinePage(): Promise<Response> {
    const shell = await scope.caches.open(shellCacheName);
    return (await shell.match(offlineUrl)) ?? Response.error();
  }

  // Resolves `null` after `ms`; `cancel` clears the timer once the race is decided.
  function startTimer(ms: number): { readonly elapsed: Promise<null>; readonly cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const elapsed = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });
    return { elapsed, cancel: () => clearTimeout(timer) };
  }

  // The network's answer, or `null` when it fails or stays silent for `ms`.
  async function raceNetwork(network: Promise<Response | null>, ms: number): Promise<Response | null> {
    const timer = startTimer(ms);
    try {
      return await Promise.race([network, timer.elapsed]);
    } finally {
      timer.cancel();
    }
  }

  // Network first with a timeout, then the kept copy of the page, then, after at most `navigationMaxWaitMs`, the offline
  // page: a network that connects and never answers never holds the app's start.
  async function navigate(event: WorkerFetchEvent): Promise<Response> {
    const url = event.request.url;
    const network = scope.fetch(event.request);
    const networkOrNull = network.then(
      (response) => response,
      () => null,
    );
    // Registered now, while the event is open: the page is kept even when it arrives after another answer was served.
    event.waitUntil(networkOrNull.then((response) => (response !== null && isWholeAnswer(response, true) ? keepPage(url, response.clone()) : undefined)));
    const first = await raceNetwork(networkOrNull, config.navigationTimeoutMs);
    if (first !== null) return first;
    const pages = await scope.caches.open(pagesCacheName);
    const kept = await pages.match(url);
    if (kept !== undefined) return kept;
    // Nothing kept: a slow network is still better than the offline page, up to the bound.
    const late = await raceNetwork(networkOrNull, config.navigationMaxWaitMs - config.navigationTimeoutMs);
    return late ?? findOfflinePage();
  }

  // A file not kept: the network for at most `assetTimeoutMs`, else a network error the page's own handling sees.
  async function fetchBounded(request: Request, keep: (response: Response) => Promise<void>): Promise<Response> {
    const network = scope.fetch(request).then(async (response) => {
      await keep(response);
      return response;
    });
    const timer = startTimer(config.assetTimeoutMs);
    try {
      const first = await Promise.race([network, timer.elapsed]);
      if (first !== null) return first;
    } finally {
      timer.cancel();
    }
    network.catch(() => undefined);
    return Response.error();
  }

  // Same-origin files: the shell's copy first; immutable files (`/_next/static/`) are kept on the way.
  async function fromShell(request: Request): Promise<Response> {
    const shell = await scope.caches.open(shellCacheName);
    const kept = await shell.match(request);
    if (kept !== undefined) return kept;
    return fetchBounded(request, async (response) => {
      if (isStatic(new URL(request.url).pathname) && isWholeAnswer(response, false)) {
        await shell.put(request, response.clone());
      }
    });
  }

  async function fromExtraOrigin(request: Request, extra: ExtraOrigin): Promise<Response> {
    const cache = await scope.caches.open(`${config.app}-${extra.cache}`);
    const kept = await cache.match(request);
    if (kept !== undefined) return kept;
    return fetchBounded(request, async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        if (extra.maxEntries !== null) await trimCache(cache, extra.maxEntries);
      }
    });
  }

  scope.addEventListener("install", (event) => {
    // No skipWaiting here: a worker that installs while another controls the page waits for the page's "activate".
    event.waitUntil(keepShell());
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(dropOtherBuilds());
  });

  scope.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    // Chrome's devtools send this pair, and fetching it from a worker throws.
    if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
    const url = new URL(request.url);
    const extra = config.extraOrigins.find((candidate) => candidate.origin === url.origin);
    if (extra !== undefined) {
      event.respondWith(fromExtraOrigin(request, extra));
      return;
    }
    if (url.origin !== origin || isExcluded(url.pathname)) return;
    event.respondWith(request.mode === "navigate" ? navigate(event) : fromShell(request));
  });

  scope.addEventListener("message", (event) => {
    const data = event.data;
    const type = typeof data === "object" && data !== null && "type" in data ? data.type : null;
    if (type === "skip-waiting") event.waitUntil(scope.skipWaiting());
    if (type === "clear-pages") event.waitUntil(scope.caches.delete(pagesCacheName));
  });
}
