// robots.txt rules, asserted on literals (FIRE L-106: a guard measuring its own constant measures itself).
import { buildRobots } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { createSettings } from "./support.js";

const ALL_CRAWLERS = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Bingbot",
  "Googlebot",
  "Applebot",
  "DuckAssistBot",
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  "MistralAI-User",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
];

describe("buildRobots", () => {
  it("opens the whole site to every crawler by default and names the AI crawlers", () => {
    expect(buildRobots(createSettings())).toEqual({
      rules: [
        { userAgent: "*", allow: ["/"], disallow: [] },
        { userAgent: ALL_CRAWLERS, allow: ["/"], disallow: [] },
      ],
      sitemap: "https://app.example.com/sitemap.xml",
    });
  });

  it("closes the private paths in every group, the named one too", () => {
    // A bot with a group of its own ignores `*` (RFC 9309 §2.2.1): a named group without the
    // disallow would open /account to it.
    const { rules } = buildRobots(createSettings({ robots: { disallow: ["/account", "/admin"] } }));
    expect(rules.map((rule) => rule.disallow)).toEqual([
      ["/account", "/admin"],
      ["/account", "/admin"],
    ]);
  });

  it("writes the root as /$ when the whole site is closed, so it opens the root only", () => {
    // `Allow: /` and `Disallow: /` tie, and the tie goes to allow (RFC 9309 §2.2.2): a bare `/`
    // would open every private page.
    const { rules } = buildRobots(createSettings({ robots: { allow: ["/", "/pricing", "/blog"], disallow: ["/"] } }));
    for (const rule of rules) {
      expect(rule.allow, String(rule.userAgent)).toEqual(["/$", "/pricing", "/blog"]);
      expect(rule.disallow, String(rule.userAgent)).toEqual(["/"]);
      expect(rule.allow).not.toContain("/");
    }
  });

  it("closes the site to a switched-off category in a group of its own", () => {
    // Left out of the named group, training crawlers would fall under `*` and be let in.
    const { rules } = buildRobots(createSettings({ crawlers: { training: { enabled: false } } }));
    expect(rules).toEqual([
      { userAgent: "*", allow: ["/"], disallow: [] },
      { userAgent: ALL_CRAWLERS.slice(0, 11), allow: ["/"], disallow: [] },
      { userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent", "Amazonbot"], disallow: ["/"] },
    ]);
  });

  it("adds the app's own crawlers to their category", () => {
    const { rules } = buildRobots(
      createSettings({ crawlers: { onDemand: { extra: ["Acme-User"] }, training: { enabled: false, extra: ["AcmeBot"] } } }),
    );
    expect(rules[1]?.userAgent).toContain("Acme-User");
    expect(rules[2]?.userAgent).toContain("AcmeBot");
    expect(rules[1]?.userAgent).not.toContain("AcmeBot");
  });

  it("keeps a crawler listed by an enabled category out of the closed group", () => {
    const { rules } = buildRobots(createSettings({ crawlers: { training: { enabled: false, extra: ["Googlebot"] } } }));
    expect(rules[2]?.userAgent).not.toContain("Googlebot");
    expect(rules[1]?.userAgent).toContain("Googlebot");
  });

  it("drops the named group when every category is off", () => {
    const off = { enabled: false };
    const { rules } = buildRobots(createSettings({ crawlers: { search: off, onDemand: off, training: off } }));
    expect(rules).toEqual([
      { userAgent: "*", allow: ["/"], disallow: [] },
      { userAgent: ALL_CRAWLERS, disallow: ["/"] },
    ]);
  });

  it("points at the sitemap on the canonical site origin", () => {
    const settings = createSettings({ origin: "https://www.example.com", canonical: { host: "apex" }, routes: { sitemap: "/map.xml" } });
    expect(buildRobots(settings).sitemap).toBe("https://example.com/map.xml");
  });
});
