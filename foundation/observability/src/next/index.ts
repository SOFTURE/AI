import type { Logger } from "../logger.js";
import type { ObservabilityOptions } from "../node/config.js";
import type { ObservabilityHandle } from "../node/start.js";

/** The `request` argument of Next.js's `onRequestError`, typed structurally so this entry imports nothing from `next`. */
export type NextRequestErrorRequest = {
  path: string;
  method: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
};

/** The `context` argument of Next.js's `onRequestError`. */
export type NextRequestErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

export type NextRequestErrorHandler = (
  error: unknown,
  request: NextRequestErrorRequest,
  context: NextRequestErrorContext,
) => void;

/**
 * Starts observability from `register()` in `instrumentation.ts`, in the Node.js runtime only (the edge runtime gets
 * nothing). Spans for outgoing `fetch` are off by default, because Next.js spans `fetch` itself; turning them on
 * calls for `NEXT_OTEL_FETCH_DISABLED=1`. Server spans from the http instrumentation are off by default too, because
 * Next.js spans every request itself; runtime metrics stay on. `traces.stableHttpAttributes` is on by default, because Next.js's own server
 * spans carry only the legacy `http.status_code`, `http.method` and `http.target`. Resolves to `null` in the edge
 * runtime.
 */
export async function registerObservability(options: ObservabilityOptions = {}): Promise<ObservabilityHandle | null> {
  if (isEdgeRuntime()) {
    return null;
  }

  const { startObservability } = await import("../node/index.js");
  return startObservability({
    ...options,
    instrumentations: { fetch: false, http: false, ...options.instrumentations },
    traces: { stableHttpAttributes: true, ...options.traces },
  });
}

/**
 * An `onRequestError` for `instrumentation.ts`: one error record per failed request with the method, path, route,
 * route type, render source and the error's digest (the one the error page shows). Request headers and the query
 * string are never logged.
 */
export function createOnRequestError(logger: Logger): NextRequestErrorHandler {
  return (error, request, context) => {
    logger.error("request failed", {
      error,
      "http.request.method": request.method,
      // Next passes the path with its query string, and a query can carry a reset or unsubscribe token.
      "url.path": request.path.split("?")[0] ?? "",
      "next.route": context.routePath,
      "next.route_type": context.routeType,
      "next.router_kind": context.routerKind,
      "next.render_source": context.renderSource,
      "next.digest": readHashDigest(error),
    });
  };
}

/**
 * Next's digest of an error when it is a hash (`<hash>` or `<hash>@E<n>`, also read as `E<n>@<hash>`), else
 * `undefined`. A `NEXT_*` digest is control flow and can carry a URL, so it is never returned.
 */
function readHashDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return undefined;
  }

  const digest = error.digest;
  return typeof digest === "string" && /^(?:[0-9]{1,32}(?:@E[0-9]{1,8})?|E[0-9]{1,8}@[0-9]{1,32})$/.test(digest)
    ? digest
    : undefined;
}

/**
 * Whether this runs in Next.js's edge runtime, which sets `NEXT_RUNTIME=edge` and defines the `EdgeRuntime` global.
 * The Node.js runtime cannot be detected the other way round: only the `next` CLI sets `NEXT_RUNTIME=nodejs`, and a
 * standalone `server.js` leaves it unset (the package is external, so the bundler does not inline it here).
 */
function isEdgeRuntime(): boolean {
  return "EdgeRuntime" in globalThis || globalThis.process?.env.NEXT_RUNTIME === "edge";
}
