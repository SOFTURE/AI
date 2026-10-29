// A fake `ServiceWorkerGlobalScope` for Node: caches in memory (insertion-ordered, as the Cache API keeps them),
// a fetch the test answers per URL, and events dispatched with their `waitUntil` and `respondWith` promises.
import type { WorkerExtendableEvent, WorkerFetchEvent, WorkerMessageEvent, WorkerScope } from "@softure-ai/pwa/worker";

export const ORIGIN = "https://app.example.com";

type Listener = (event: never) => void;

function toUrl(request: RequestInfo | URL): string {
  if (typeof request === "string") return new URL(request, ORIGIN).href;
  return request instanceof URL ? request.href : request.url;
}

export class FakeCache {
  readonly entries = new Map<string, Response>();

  match(request: RequestInfo | URL): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(toUrl(request))?.clone());
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    // Read the body now, as a real cache does, so a used body fails here and not later.
    const body = await response.arrayBuffer();
    this.entries.set(toUrl(request), new Response(body, { status: response.status, headers: response.headers }));
  }

  delete(request: RequestInfo | URL): Promise<boolean> {
    return Promise.resolve(this.entries.delete(toUrl(request)));
  }

  keys(): Promise<Request[]> {
    return Promise.resolve([...this.entries.keys()].map((url) => new Request(url)));
  }

  /** The kept URLs as paths, oldest first. */
  getPaths(): string[] {
    return [...this.entries.keys()].map((url) => {
      const parsed = new URL(url);
      return parsed.origin === ORIGIN ? `${parsed.pathname}${parsed.search}` : url;
    });
  }
}

export class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  open(name: string): Promise<FakeCache> {
    const cache = this.caches.get(name) ?? new FakeCache();
    this.caches.set(name, cache);
    return Promise.resolve(cache);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.has(name));
  }

  /** The cache by name; fails the test when it does not exist. */
  get(name: string): FakeCache {
    const cache = this.caches.get(name);
    if (cache === undefined) throw new Error(`no cache ${name}; caches: ${[...this.caches.keys()].join(", ")}`);
    return cache;
  }
}

export interface AnswerOptions {
  readonly status?: number;
  readonly contentType?: string;
  readonly redirected?: boolean;
  /** `basic` by default: what the browser gives for a same-origin fetch. */
  readonly type?: ResponseType;
}

/** A response as the browser's fetch hands it over, with the read-only `type` and `redirected` it would carry. */
export function answer(body: string, { status = 200, contentType = "text/html; charset=utf-8", redirected = false, type = "basic" }: AnswerOptions = {}): Response {
  const response = new Response(status === 204 || status === 304 ? null : body, { status, headers: { "content-type": contentType } });
  Object.defineProperty(response, "type", { value: type });
  Object.defineProperty(response, "redirected", { value: redirected });
  return response;
}

/** A copy of an `answer`, keeping the `type` and `redirected` a plain clone drops. */
export function cloneAnswer(response: Response): Response {
  const copy = response.clone();
  Object.defineProperty(copy, "type", { value: response.type });
  Object.defineProperty(copy, "redirected", { value: response.redirected });
  return copy;
}

export type FetchHandler = (request: Request) => Promise<Response>;

export interface DispatchedFetch {
  /** `null` when the worker left the request to the browser. */
  readonly response: Promise<Response> | null;
  /** Every `waitUntil` promise of the event, settled. */
  readonly settled: () => Promise<void>;
}

export class FakeWorkerScope {
  readonly location = { origin: ORIGIN };
  readonly caches = new FakeCacheStorage();
  readonly fetched: string[] = [];
  readonly routes = new Map<string, FetchHandler>();
  isClaimed = false;
  hasSkippedWaiting = false;
  private readonly listeners = new Map<string, Listener[]>();

  /** Answers `path` (or an absolute URL) with `handler`; anything else fails as a network error. */
  route(path: string, handler: FetchHandler | Response): void {
    this.routes.set(toUrl(path), typeof handler === "function" ? handler : () => Promise.resolve(cloneAnswer(handler)));
  }

  /** The scope as the worker sees it. */
  asScope(): WorkerScope {
    return {
      location: this.location,
      caches: this.caches as unknown as CacheStorage,
      clients: {
        claim: () => {
          this.isClaimed = true;
          return Promise.resolve();
        },
      },
      skipWaiting: () => {
        this.hasSkippedWaiting = true;
        return Promise.resolve();
      },
      fetch: (request) => {
        this.fetched.push(request.url);
        const handler = this.routes.get(request.url);
        return handler === undefined ? Promise.reject(new TypeError(`Failed to fetch ${request.url}`)) : handler(request);
      },
      addEventListener: (type: string, listener: Listener) => {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      },
    };
  }

  private dispatch(type: string, event: object): void {
    for (const listener of this.listeners.get(type) ?? []) (listener as (event: object) => void)(event);
  }

  /** Dispatches `install` or `activate` and waits for its `waitUntil` promises; rejects as the browser would fail it. */
  async dispatchLifecycle(type: "install" | "activate"): Promise<void> {
    const promises: Promise<unknown>[] = [];
    const event: WorkerExtendableEvent = { waitUntil: (promise) => promises.push(promise) };
    this.dispatch(type, event);
    await Promise.all(promises);
  }

  dispatchMessage(data: unknown): Promise<void> {
    const promises: Promise<unknown>[] = [];
    const event: WorkerMessageEvent = { data, waitUntil: (promise) => promises.push(promise) };
    this.dispatch("message", event);
    return Promise.all(promises).then(() => undefined);
  }

  dispatchFetch(request: Request): DispatchedFetch {
    const promises: Promise<unknown>[] = [];
    let response: Promise<Response> | null = null;
    const event: WorkerFetchEvent = {
      request,
      respondWith: (answered) => {
        response = answered;
      },
      waitUntil: (promise) => promises.push(promise),
    };
    this.dispatch("fetch", event);
    return {
      response,
      settled: async () => {
        await response?.catch(() => undefined);
        await Promise.all(promises);
      },
    };
  }
}

/** A navigation request, as the browser sends it for a page. */
export function navigation(path: string): Request {
  // `mode: "navigate"` cannot be set on a constructed Request, so it is set the way the browser reports it.
  const request = new Request(new URL(path, ORIGIN));
  Object.defineProperty(request, "mode", { value: "navigate" });
  return request;
}
