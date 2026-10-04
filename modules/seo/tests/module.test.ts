// The module definition: its manifest and its options.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { seo } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";

describe("the seo module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(seo));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(seo.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: everything open, every category allowed, no key", () => {
    const allowed = { enabled: true, extra: [] };
    expect(seo().options).toEqual({
      canonical: { host: "as-is", trailingSlash: false },
      robots: { allow: ["/"], disallow: [] },
      crawlers: { search: allowed, onDemand: allowed, training: allowed },
      sitemap: { entries: [], contributors: [] },
    });
    expect(seo().routes).toEqual({ sitemap: "/sitemap.xml", indexNowKey: "/indexnow-key.txt" });
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      seo({
        origin: "https://example.com/app",
        robots: { disallow: ["account", "//evil"] },
        crawlers: { training: { extra: ["Bad/Bot"] } },
        sitemap: { entries: [{ path: "/", priority: 2 }] },
        indexNow: { key: "short" },
        // @ts-expect-error: the test passes values the types already forbid, as a JavaScript config could.
        extra: true,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "seo":',
        "- options.origin: must be an http(s) origin without a path, e.g. https://example.com",
        "- options.robots.disallow.0: must be a path starting with a single /",
        "- options.robots.disallow.1: must be a path starting with a single /",
        "- options.crawlers.training.extra.0: is not a robots.txt token: letters, digits, space, . _ and -",
        "- options.sitemap.entries.0.priority: Too big: expected number to be <=1",
        "- options.indexNow.key: must be 8 to 128 letters, digits or dashes (IndexNow key format)",
        '- options: Unrecognized key: "extra"',
      ].join("\n"),
    );
  });

  it("refuses a sitemap contributor that is not a function", () => {
    // @ts-expect-error: a JavaScript config could pass a list instead of a function.
    expect(() => seo({ sitemap: { contributors: [[{ path: "/" }]] } })).toThrow(
      "- options.sitemap.contributors.0: must be a function (context) => SitemapEntry[] | Promise<SitemapEntry[]>",
    );
  });
});
