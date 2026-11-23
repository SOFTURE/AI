import { describe, expect, it } from "vitest";
import { parseInventory } from "../inventory/index.js";
import { mergeBypassPaths, readPublicPaths } from "./public-paths.js";

function makeApp(bypassPaths: string[]) {
  const inventory = parseInventory(
    {
      server: { host: "srv.example.com", adminUser: "admin" },
      edge: { acmeEmail: "ops@example.com", cdn: "cloudflare" },
      apps: [{ slug: "notes", repo: "acme/notes", host: "notes.example.com", access: { enabled: true, bypassPaths, emails: ["owner@example.com"] } }],
    },
    "t",
  );
  const app = inventory.apps[0];
  if (app === undefined) throw new Error("fixture has an app");
  return app;
}

describe("readPublicPaths", () => {
  it("reads the list, and null without a file or without the key", () => {
    expect(readPublicPaths('{ "publicPaths": ["/api/health", "/api/mcp"] }')).toEqual({ ok: true, paths: ["/api/health", "/api/mcp"] });
    expect(readPublicPaths(null)).toEqual({ ok: true, paths: null });
    expect(readPublicPaths('{ "verify": { "routes": [] } }')).toEqual({ ok: true, paths: null });
  });

  it("names a file that is not JSON, a list of something else, and a path Access cannot match", () => {
    expect(readPublicPaths("{")).toEqual({ ok: false, problem: "deploy.json is not valid JSON" });
    expect(readPublicPaths('{ "publicPaths": "/api" }')).toEqual({ ok: false, problem: "deploy.json publicPaths is not a list of paths" });
    expect(readPublicPaths('{ "publicPaths": ["/ok", "api", "/a?b"] }')).toEqual({
      ok: false,
      problem: "deploy.json publicPaths has paths Access cannot match: api, /a?b",
    });
  });
});

describe("mergeBypassPaths", () => {
  it("adds the public paths the inventory does not list and names inventory paths that are not public", () => {
    const merged = mergeBypassPaths(makeApp(["/webhooks", "/api/health"]), ["/api/health", "/api/mcp"]);
    expect(merged.app.access.bypassPaths).toEqual(["/webhooks", "/api/health", "/api/mcp"]);
    expect(merged.added).toEqual(["/api/mcp"]);
    expect(merged.notPublic).toEqual(["/webhooks"]);
  });
});
