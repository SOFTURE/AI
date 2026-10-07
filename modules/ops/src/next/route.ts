// `GET /api/health`, shipped in the package and mounted with one line:
// `app/api/health/route.ts → export { GET } from "@softure-ai/ops/next"`.
//
// The answer itself is `createHealthResponse` from `@softure-ai/ops/server`; this file adds only what
// needs Next and a request scope.
import { getSoftureConfig } from "@softure-ai/core/next";
import { connection } from "next/server";
import { createHealthResponse } from "../server/health-response.js";

export async function GET(): Promise<Response> {
  // Dynamic by the route's own code, whatever Next's default for GET handlers is: a prerendered "ok"
  // is the false green this route exists to prevent. A segment config cannot travel with the handler
  // (`export { dynamic } from` fails the build: "It mustn't be reexported", measured on Next 16).
  await connection();
  return createHealthResponse(getSoftureConfig());
}
