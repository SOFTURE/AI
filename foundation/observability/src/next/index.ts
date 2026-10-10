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
 * calls for `NEXT_OTEL_FETCH_DISABLED=1`. Resolves to `null` outside the Node.js runtime.
 */
export async function registerObservability(options: ObservabilityOptions = {}): Promise<ObservabilityHandle | null> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return null;
  }

  const { startObservability } = await import("../node/index.js");
  return startObservability({ ...options, instrumentations: { fetch: false, ...options.instrumentations } });
}

/**
 * An `onRequestError` for `instrumentation.ts`: one error record per failed request with the method, path, route
 * and route type. Request headers and the query string are never logged.
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
    });
  };
}
