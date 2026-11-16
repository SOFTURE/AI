// withDatabaseBuild: one call in next.config.ts, a build per host (docs/07-runtime-providers.md).
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { registerCloudflareSockets } from "@softure-ai/db/request";
import { getCloudflareAliases, withDatabaseBuild } from "@softure-ai/db/next-config";
import { afterEach, describe, expect, it } from "vitest";
import { connect } from "../src/next-config/cloudflare-sockets.js";
import { drizzle, PGlite } from "../src/next-config/pglite-unavailable.js";

const APP_DIR = resolve(import.meta.dirname, "..");
const CONNECT_KEY = Symbol.for("@softure-ai/db/cloudflare-sockets-connect");

describe("withDatabaseBuild", () => {
  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[CONNECT_KEY];
  });

  it("keeps the database layer and pg external on a VPS, next to the app's own externals", () => {
    const config = withDatabaseBuild({ serverExternalPackages: ["sharp", "pg"], poweredByHeader: false }, { host: "vps", appDir: APP_DIR });
    expect(config).toEqual({ serverExternalPackages: ["sharp", "pg", "@softure-ai/db"], poweredByHeader: false });
  });

  it("bundles everything on Cloudflare: no database externals, pg transpiled, the aliases added to the app's own", () => {
    const config = withDatabaseBuild(
      { serverExternalPackages: ["@softure-ai/db", "pg", "sharp"], turbopack: { root: APP_DIR, resolveAlias: { "app-alias": "./x.ts" } } },
      { host: "cloudflare", appDir: APP_DIR },
    );
    expect(config.serverExternalPackages).toEqual(["sharp"]);
    expect(config.transpilePackages).toEqual(["pg"]);
    expect(config.turbopack?.root).toBe(APP_DIR);
    expect(config.turbopack?.resolveAlias).toEqual({ "app-alias": "./x.ts", ...getCloudflareAliases(APP_DIR) });
  });

  it("points every Cloudflare alias at a file that exists, relative to the app's folder", () => {
    const aliases = getCloudflareAliases(APP_DIR);
    expect(Object.keys(aliases)).toEqual(["@electric-sql/pglite", "drizzle-orm/pglite", "pg-cloudflare", "cloudflare:sockets"]);
    for (const target of Object.values(aliases)) {
      expect(target.startsWith("./")).toBe(true);
      expect(existsSync(join(APP_DIR, target))).toBe(true);
    }
    expect(aliases["pg-cloudflare"]).toMatch(/pg-cloudflare\/dist\/index\.js$/);
    expect(aliases["cloudflare:sockets"]).toBe("./src/next-config/cloudflare-sockets.ts");
  });

  it("gives PGlite a stand-in that refuses with the reason", () => {
    const message = "PGlite is not available on Cloudflare Workers: use a postgres:// URL (a Hyperdrive binding)";
    expect(() => new PGlite()).toThrow(message);
    expect(() => drizzle()).toThrow(message);
  });

  it("hands the proxy bundle the connect the Worker entry registered, and says what is missing before that", () => {
    expect(() => connect({ hostname: "db", port: 5432 })).toThrow(
      "cloudflare:sockets is not registered: call registerCloudflareSockets(connect) in the Worker's entry (worker.ts)",
    );
    const calls: unknown[][] = [];
    registerCloudflareSockets((...args: never[]) => {
      calls.push(args);
      return "socket";
    });
    expect(connect({ hostname: "db", port: 5432 }, { secureTransport: "starttls" })).toBe("socket");
    expect(calls).toEqual([[{ hostname: "db", port: 5432 }, { secureTransport: "starttls" }]]);
  });
});
