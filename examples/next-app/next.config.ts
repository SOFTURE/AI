import { withDatabaseBuild } from "@softure-ai/db/next-config";
import { withBuildInfo } from "@softure-ai/ops/next-config";
import { buildHtmlLimitedBots } from "@softure-ai/seo";
import type { NextConfig } from "next";

// The same app on both hosts (docs/07-runtime-providers.md): SOFTURE_HOST=cloudflare builds it for Workers with
// OpenNext (`npm run build:cloudflare`), anything else for Node (`npm run build`). softure.config.ts reads the same switch.
const HOST = process.env.SOFTURE_HOST === "cloudflare" ? "cloudflare" : "vps";

const nextConfig: NextConfig = {
  // @softure-ai/observability keeps OpenTelemetry's SDK out of the bundle on Node, so its module hooks run in Node.js
  // itself; workerd has no node_modules to load it from, and its Workers entry needs no hooks.
  serverExternalPackages: HOST === "vps" ? ["@softure-ai/observability"] : [],
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

// The database layer's build for the host (pg and PGlite external on Node; bundled, with pg's Workers socket, on
// Cloudflare), then the commit and the build time for GET /api/health/build (e2e/ops.spec.ts).
export default withBuildInfo(withDatabaseBuild(nextConfig, { host: HOST, appDir: import.meta.dirname }));
