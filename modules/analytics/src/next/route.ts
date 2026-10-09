// The funnel endpoint, mounted with one line:
// `app/api/analytics/funnel/route.ts → export const { GET, POST } = createFunnelRoute();`
// `POST` takes beacons, `GET` serves the pixel. Both answer `no-store`: a pixel kept by the browser
// or a CDN would stop counting, silently. `getContext` replaces the registered config's database,
// e.g. a test database: `createFunnelRoute({ getContext: () => Promise.resolve(testCtx) })`.
import { errorLogLabel } from "@softure-ai/core";
import { handleFunnelBeacon, handleFunnelPixel } from "../server/endpoint.js";
import type { AnalyticsContext } from "../server/funnel.js";
import { getAnalyticsContext } from "./context.js";

export interface FunnelRoute {
  readonly GET: (request: Request) => Promise<Response>;
  readonly POST: (request: Request) => Promise<Response>;
}

export interface FunnelRouteOptions {
  /** The context the endpoint counts in; `getAnalyticsContext()` (the registered config's database) by default. */
  readonly getContext?: () => Promise<AnalyticsContext>;
}

export function createFunnelRoute(options: FunnelRouteOptions = {}): FunnelRoute {
  const getContext = options.getContext ?? (() => getAnalyticsContext());
  const withContext = (handle: (ctx: AnalyticsContext, request: Request) => Promise<Response>) => async (request: Request) => {
    let ctx;
    try {
      ctx = await getContext();
    } catch (error) {
      console.error(`@softure-ai/analytics: opening the database failed: ${errorLogLabel(error)}`);
      return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
    }
    return handle(ctx, request);
  };
  return { GET: withContext(handleFunnelPixel), POST: withContext(handleFunnelBeacon) };
}
