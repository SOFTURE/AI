// The build info route, mounted with one line:
// `app/api/health/build/route.ts → export const GET = createBuildInfoRoute()`.
//
// The answer itself is `createBuildInfoResponse` from `@softure-ai/ops/server`; this file adds only what needs Next.
import { connection } from "next/server";
import { createBuildInfoResponse, type BuildInfoOptions } from "../server/build-info.js";

/** A `GET` handler that answers the build info of this process (see `BuildInfoOptions` for the values it reads). */
export function createBuildInfoRoute(options: BuildInfoOptions = {}): () => Promise<Response> {
  return async function GET(): Promise<Response> {
    // Dynamic by the route's own code: a prerendered answer would carry the build time as the start time and the
    // release of the build machine.
    await connection();
    return createBuildInfoResponse(options);
  };
}
