// The Next files as the app mounts them: settings from the registered config.
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { seo, type SeoOptionsInput } from "@softure-ai/seo";
import { getCanonicalUrl, getSeoSettings, robots, serveIndexNowKey, sitemap } from "@softure-ai/seo/next";
import { afterEach, describe, expect, it } from "vitest";

const KEY = "0123456789abcdef0123456789abcdef";

function register(options: SeoOptionsInput | null): void {
  registerSoftureConfig(
    defineSoftureConfig({
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: "https://app.example.com",
      modules: options === null ? [] : [seo(options)],
    }),
  );
}

describe("the Next adapter", () => {
  afterEach(() => {
    clearSoftureConfig();
  });

  it("serves robots from the module's options", () => {
    register({ origin: "https://example.com", robots: { allow: ["/"], disallow: ["/"] }, crawlers: { training: { enabled: false } } });
    const result = robots();
    expect(result.sitemap).toBe("https://example.com/sitemap.xml");
    expect(result.rules).toHaveLength(3);
    expect(result.rules).toContainEqual({ userAgent: "*", allow: ["/$"], disallow: ["/"] });
  });

  it("serves the sitemap from the module's entries and contributors", async () => {
    register({ sitemap: { entries: [{ path: "/" }], contributors: [() => [{ path: "/blog" }]] } });
    expect(await sitemap()).toEqual([{ url: "https://app.example.com/" }, { url: "https://app.example.com/blog" }]);
  });

  it("serves the IndexNow key as plain text", async () => {
    register({ indexNow: { key: KEY } });
    const response = serveIndexNowKey();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(KEY);
  });

  it("answers 404 for the key file when the app set no key", () => {
    register({});
    expect(serveIndexNowKey().status).toBe(404);
  });

  it("gives canonical URLs on the site origin", () => {
    register({ origin: "https://www.example.com", canonical: { host: "apex", trailingSlash: true } });
    expect(getCanonicalUrl("/pricing")).toBe("https://example.com/pricing/");
  });

  it("names the fix when the module is not enabled", () => {
    register(null);
    expect(() => robots()).toThrow("@softure-ai/seo: the seo module is not enabled; add seo() to modules in softure.config.ts");
  });

  it("reads a config passed in, outside a request", () => {
    const config = defineSoftureConfig({ locale: "en", timezone: "Europe/Warsaw", appOrigin: "https://example.com", modules: [seo({ indexNow: { key: KEY } })] });
    expect(getSeoSettings(config)).toMatchObject({ siteOrigin: "https://example.com", indexNowKey: KEY, routes: { indexNowKey: "/indexnow-key.txt" } });
  });
});
