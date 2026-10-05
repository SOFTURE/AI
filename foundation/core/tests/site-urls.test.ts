// The site-URL contract: one enabled module decides the public origin and the canonical URL of a path
// for the others, and without a provider every URL is built on the config's `appOrigin`.
import { defineSoftureConfig, findSiteUrlProvider, getSiteUrls, type SiteUrlProvider } from "@softure-ai/core";
import { describe, expect, it, vi } from "vitest";
import { catchConfigError, createTestModule } from "./support.js";

const BASE = { locale: "en", timezone: "Europe/Warsaw", appOrigin: "https://app.example.com" } as const;

describe("getSiteUrls", () => {
  it("builds on appOrigin when no enabled module provides the site URLs", () => {
    const config = defineSoftureConfig({ ...BASE, modules: [createTestModule({ id: "asker" })] });
    const urls = getSiteUrls(config);
    expect(findSiteUrlProvider(config)).toBeNull();
    expect(urls.origin).toBe("https://app.example.com");
    expect(urls.getCanonicalUrl("/blog")).toBe("https://app.example.com/blog");
    expect(urls.getCanonicalUrl("/blog/")).toBe("https://app.example.com/blog/");
    expect(urls.getCanonicalUrl("/")).toBe("https://app.example.com/");
  });

  it("refuses a fallback path that is not on the site", () => {
    const urls = getSiteUrls(defineSoftureConfig({ ...BASE, modules: [] }));
    expect(() => urls.getCanonicalUrl("blog")).toThrow('getCanonicalUrl: "blog" is not a path on the site; pass a path starting with a single /');
    expect(() => urls.getCanonicalUrl("//evil.example")).toThrow(/is not a path on the site/);
  });

  it("asks the provider with the config and returns its answer", () => {
    const answer = { origin: "https://example.com", getCanonicalUrl: (path: string) => `https://example.com${path}/` };
    const provider = vi.fn<SiteUrlProvider>(() => answer);
    const config = defineSoftureConfig({ ...BASE, modules: [createTestModule({ id: "asker" }), createTestModule({ id: "provider", siteUrls: provider })] });

    expect(getSiteUrls(config)).toBe(answer);
    expect(provider).toHaveBeenCalledWith(config);
    expect(findSiteUrlProvider(config)).toBe(provider);
  });

  it("refuses a config with two providers, naming both", () => {
    const provider: SiteUrlProvider = (config) => getSiteUrls({ ...config, modules: [] });
    const error = catchConfigError(() =>
      defineSoftureConfig({ ...BASE, modules: [createTestModule({ id: "first", siteUrls: provider }), createTestModule({ id: "second", siteUrls: provider })] }),
    );
    expect(error.issues).toEqual(["modules: only one module may provide the site URLs; first, second all do"]);
  });
});
