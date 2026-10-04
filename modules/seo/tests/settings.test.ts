// The site origin and canonical URLs.
import { buildCanonicalUrl, getSiteOrigin } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { createSettings } from "./support.js";

describe("getSiteOrigin", () => {
  it("keeps the host as it is by default", () => {
    expect(getSiteOrigin("https://www.example.com", "as-is")).toBe("https://www.example.com");
  });

  it("drops one leading www. for apex and adds it for www, once", () => {
    expect(getSiteOrigin("https://www.example.com", "apex")).toBe("https://example.com");
    expect(getSiteOrigin("https://example.com", "apex")).toBe("https://example.com");
    expect(getSiteOrigin("https://example.com", "www")).toBe("https://www.example.com");
    expect(getSiteOrigin("https://www.example.com", "www")).toBe("https://www.example.com");
  });

  it("keeps the scheme and the port", () => {
    expect(getSiteOrigin("http://localhost:3100", "as-is")).toBe("http://localhost:3100");
  });
});

describe("buildCanonicalUrl", () => {
  it("builds on the module's origin, not the app's, when the app sets one", () => {
    const settings = createSettings({ origin: "https://example.com" });
    expect(buildCanonicalUrl("/pricing", settings)).toBe("https://example.com/pricing");
  });

  it("falls back to the config's appOrigin", () => {
    expect(buildCanonicalUrl("/pricing", createSettings())).toBe("https://app.example.com/pricing");
  });

  it("strips a trailing slash by default and adds one when asked; the root stays /", () => {
    const plain = createSettings({ origin: "https://example.com" });
    const slashed = createSettings({ origin: "https://example.com", canonical: { trailingSlash: true } });
    expect(buildCanonicalUrl("/blog/", plain)).toBe("https://example.com/blog");
    expect(buildCanonicalUrl("/blog", slashed)).toBe("https://example.com/blog/");
    expect(buildCanonicalUrl("/", plain)).toBe("https://example.com/");
    expect(buildCanonicalUrl("/", slashed)).toBe("https://example.com/");
  });

  it("drops the query and the hash", () => {
    expect(buildCanonicalUrl("/pricing?z=ads#plans", createSettings({ origin: "https://example.com" }))).toBe("https://example.com/pricing");
  });

  it("refuses what is not a path on the site", () => {
    const settings = createSettings();
    expect(() => buildCanonicalUrl("https://evil.example/", settings)).toThrow('buildCanonicalUrl: "https://evil.example/" is not a path on the site');
    expect(() => buildCanonicalUrl("//evil.example/", settings)).toThrow("is not a path on the site");
  });
});
