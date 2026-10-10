import { buildHtmlLimitedBots } from "@softure-ai/seo";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @softure-ai/db loads its driver through import() only when a URL needs it, so it stays out of the
  // bundle: Turbopack never resolves the driver this app does not install (PGlite), and output tracing
  // copies the one it does (pg). pg itself loads native bindings optionally (db README §2).
  // @softure-ai/observability keeps OpenTelemetry's SDK out of the bundle, so its module hooks run in Node.js itself.
  serverExternalPackages: ["@softure-ai/db", "pg", "@softure-ai/observability"],
  poweredByHeader: false,
  // Next's default list of bots that get metadata in <head>, plus the AI crawlers (e2e/seo.spec.ts).
  htmlLimitedBots: buildHtmlLimitedBots(),
  // The container image (Dockerfile) runs the standalone server; `npm run e2e` keeps `next start`.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // Resolve only inside this folder. Above it lies the repository's node_modules, whose workspace
  // links would quietly stand in for a packed copy that lacks a file (measured: with `dist` dropped
  // from ui's `files`, the build still passed until this was set).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
