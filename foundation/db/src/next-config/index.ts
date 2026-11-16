// The `next.config` helper of @softure-ai/db (docs/07-runtime-providers.md): one call, `withDatabaseBuild(config,
// { host })`, and a build per host underneath. Plain Node, no Next import, safe to load from next.config.ts.
//
// - vps: the database layer and pg stay external, so Turbopack never resolves the driver an app does not install
//   (PGlite) and output tracing copies the one it does (pg).
// - cloudflare: everything is bundled (workerd has no node_modules to load from), PGlite gives way to a stand-in that
//   refuses, pg gets its Workers socket, and `cloudflare:sockets` reaches the app's proxy bundle through the Worker
//   entry (`registerCloudflareSockets`).
import { createRequire } from "node:module";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { SoftureHost } from "@softure-ai/core";

/** The part of Next's config this helper writes; the rest passes through untouched. */
export interface DatabaseBuildConfig {
  serverExternalPackages?: string[];
  transpilePackages?: string[];
  // Only `resolveAlias` is written; no index signature, so Next's own (interface) types stay assignable.
  turbopack?: { resolveAlias?: object };
}

export interface WithDatabaseBuildOptions {
  /** The app's host, as in `platform.host` of softure.config.ts. */
  readonly host: SoftureHost;
  /** The app's folder, from which aliases are written; default the current directory (where `next build` runs). */
  readonly appDir?: string;
}

/** The packages a VPS build keeps out of the bundle. */
export const NODE_EXTERNAL_PACKAGES = ["@softure-ai/db", "pg"] as const;

const builds: Record<SoftureHost, <T extends DatabaseBuildConfig>(config: T, appDir: string) => T & DatabaseBuildConfig> = {
  vps: (config) => ({ ...config, serverExternalPackages: merge(config.serverExternalPackages, NODE_EXTERNAL_PACKAGES) }),
  cloudflare: (config, appDir) => ({
    ...config,
    serverExternalPackages: (config.serverExternalPackages ?? []).filter((name) => !(NODE_EXTERNAL_PACKAGES as readonly string[]).includes(name)),
    // Next keeps pg external by default; here it is bundled like everything else.
    transpilePackages: merge(config.transpilePackages, ["pg"]),
    turbopack: {
      ...config.turbopack,
      resolveAlias: { ...config.turbopack?.resolveAlias, ...getCloudflareAliases(appDir) },
    },
  }),
};

/** `config` with what the database layer needs on `host`. */
export function withDatabaseBuild<T extends DatabaseBuildConfig>(config: T, options: WithDatabaseBuildOptions): T & DatabaseBuildConfig {
  return builds[options.host](config, options.appDir ?? process.cwd());
}

/** Turbopack aliases of a Cloudflare build, as paths relative to the app's folder. */
export function getCloudflareAliases(appDir: string): Record<string, string> {
  const require = createRequire(join(appDir, "package.json"));
  // The stand-ins sit next to this file: `.js` in the published package, `.ts` when run from source.
  const here = fileURLToPath(import.meta.url);
  const stub = (name: string) => join(dirname(here), `${name}${extname(here)}`);
  // pg-cloudflare exports its socket only under the `workerd` condition, which the proxy's bundle (OpenNext's Node
  // middleware) does not resolve with, so it would get the package's empty stand-in.
  const pgRequire = createRequire(require.resolve("pg"));
  const pgCloudflare = join(dirname(pgRequire.resolve("pg-cloudflare/package.json")), "dist", "index.js");
  const fromApp = (path: string) => `./${relative(appDir, path).split("\\").join("/")}`;
  return {
    "@electric-sql/pglite": fromApp(stub("pglite-unavailable")),
    "drizzle-orm/pglite": fromApp(stub("pglite-unavailable")),
    "pg-cloudflare": fromApp(pgCloudflare),
    "cloudflare:sockets": fromApp(stub("cloudflare-sockets")),
  };
}

function merge(existing: readonly string[] | undefined, added: readonly string[]): string[] {
  return [...new Set([...(existing ?? []), ...added])];
}
