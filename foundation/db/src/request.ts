// The request-scoped database (docs/07-runtime-providers.md). On Cloudflare Workers an open socket belongs to the
// request that opened it, so a pool kept on `globalThis` breaks on the next request. A Worker wraps its fetch handler
// in `withRequestDatabase`: the first query in the request opens a handle on the request's URL (the Hyperdrive
// binding's connection string), every module reaches it through `getConfiguredDatabase`, and it is closed after the
// handler settles, through `waitUntil` when the platform gives one. On Node nothing changes outside a scope.
import { AsyncLocalStorage } from "node:async_hooks";
import { createDatabase, type DatabaseHandle } from "./client.js";

const PGLITE_PREFIX = "pglite://";

export interface RequestDatabaseOptions {
  /** The database URL for this request; on Workers `env.<HYPERDRIVE_BINDING>.connectionString`. */
  readonly url: string;
  /** The platform's `ctx.waitUntil`: the handle closes after the response instead of delaying it. */
  readonly waitUntil?: (promise: Promise<unknown>) => void;
  /** Connections in the request's pool. Default 1: Hyperdrive pools on its side. */
  readonly max?: number;
}

interface RequestScope {
  readonly options: RequestDatabaseOptions;
  handle: Promise<DatabaseHandle> | undefined;
  /** Work the request handed to `waitUntil` (Next's `after()`), which may still query: the close waits for it. */
  readonly pending: Set<Promise<unknown>>;
}

/** What `withRequestDatabase` gives the handler it runs. */
export interface RequestDatabaseScope {
  /**
   * The platform's `waitUntil` for work that runs after the response and may still query (Next's `after()`): the
   * request's handle stays open until it settles. Pass it to the framework in place of the platform's own.
   */
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

const SCOPE_KEY = Symbol.for("@softure-ai/db/request-scope");

type ScopeHost = Record<typeof SCOPE_KEY, AsyncLocalStorage<RequestScope> | undefined>;

/** One storage per process, shared by every copy of this file in separate bundles. */
function getStorage(): AsyncLocalStorage<RequestScope> {
  const host = globalThis as unknown as ScopeHost;
  return (host[SCOPE_KEY] ??= new AsyncLocalStorage<RequestScope>());
}

export const NO_REQUEST_DATABASE_MESSAGE =
  "No request database on Cloudflare Workers: wrap the Worker's fetch handler in withRequestDatabase({ url, waitUntil }, handler) from @softure-ai/db/request";

/**
 * Runs `run` with a database scoped to one request and closes the handle once `run` settles (resolved or thrown).
 * When `run` answers a `Response` with a body, the handle stays open until that body has been sent or cancelled: a
 * streamed page (React server rendering) keeps querying after the handler has returned its `Response`. Work `run`
 * hands to the scope's `waitUntil` (Next's `after()`) keeps it open too. The handle opens on the first query, so a
 * request that never queries opens no connection.
 */
export async function withRequestDatabase<T>(
  options: RequestDatabaseOptions,
  run: (scope: RequestDatabaseScope) => Promise<T>,
): Promise<T> {
  const scope: RequestScope = { options, handle: undefined, pending: new Set() };
  const tools: RequestDatabaseScope = {
    waitUntil: (promise) => {
      const settled = promise.then(
        () => undefined,
        () => undefined,
      );
      scope.pending.add(settled);
      void settled.then(() => scope.pending.delete(settled));
      options.waitUntil?.(promise);
    },
  };
  let result: T;
  try {
    result = await getStorage().run(scope, () => run(tools));
  } catch (error) {
    await closeWhenSettled(scope);
    throw error;
  }
  if (!(result instanceof Response) || result.body === null) {
    await closeWhenSettled(scope);
    return result;
  }
  return closeAfterBody(result, scope) as T;
}

/** The same response, its body passed through a stream whose end (or cancel) lets the request's handle close. */
function closeAfterBody(response: Response, scope: RequestScope): Response {
  const body = response.body;
  if (body === null) throw new Error("closeAfterBody: the response has no body");
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  // A failed or cancelled body still closes the handle; the reader already sees the failure.
  const sent = body.pipeTo(writable).then(
    () => closeWhenSettled(scope),
    () => closeWhenSettled(scope),
  );
  scope.options.waitUntil?.(sent);
  return new Response(readable, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/**
 * Closes the handle once every piece of work handed to the scope's `waitUntil` has settled, including work added
 * while waiting. Without the platform's `waitUntil` it resolves when the handle is closed.
 */
async function closeWhenSettled(scope: RequestScope): Promise<void> {
  if (scope.pending.size === 0) {
    await closeScope(scope);
    return;
  }
  const drained = (async () => {
    while (scope.pending.size > 0) await Promise.all([...scope.pending]);
    await closeScope(scope);
  })();
  if (scope.options.waitUntil === undefined) {
    await drained;
    return;
  }
  scope.options.waitUntil(drained);
}

/** The current request's handle, opened on first call; `undefined` outside `withRequestDatabase`. */
export function getRequestDatabase(): Promise<DatabaseHandle> | undefined {
  const scope = getStorage().getStore();
  if (scope === undefined) return undefined;
  scope.handle ??= openRequestHandle(scope.options);
  return scope.handle;
}

/** Whether this code runs in Cloudflare's workerd: a safety net for a missing scope, not a source of config. */
export function isWorkersRuntime(): boolean {
  const navigatorLike = (globalThis as { navigator?: { userAgent?: unknown } }).navigator;
  return navigatorLike?.userAgent === "Cloudflare-Workers";
}

function openRequestHandle(options: RequestDatabaseOptions): Promise<DatabaseHandle> {
  if (options.url.startsWith(PGLITE_PREFIX)) {
    return Promise.reject(new Error("withRequestDatabase: PGlite is Node-only; use a postgres:// URL (on Workers, a Hyperdrive binding)"));
  }
  return createDatabase(options.url, { max: options.max ?? 1 });
}

/** Hands the close to `waitUntil` when given (resolves at once), otherwise resolves when the handle is closed. */
async function closeScope(scope: RequestScope): Promise<void> {
  const opened = scope.handle;
  if (opened === undefined) return;
  // A handle that failed to open has nothing to close; its error already reached the query that asked for it.
  const closing = opened.then(
    (handle) => handle.close(),
    () => undefined,
  );
  if (scope.options.waitUntil === undefined) {
    await closing;
    return;
  }
  scope.options.waitUntil(closing);
}
