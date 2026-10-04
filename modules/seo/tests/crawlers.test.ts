// The htmlLimitedBots list: Next's default kept word for word, the AI bots added.
import { AI_ON_DEMAND_FETCHERS, AI_SEARCH_CRAWLERS, AI_TRAINING_CRAWLERS, buildHtmlLimitedBots, NEXT_DEFAULT_HTML_LIMITED_BOTS } from "@softure-ai/seo";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots.js";
import { describe, expect, it } from "vitest";

/** Real User-Agent headers, not robots.txt tokens. */
const AI_USER_AGENTS = [
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.3; +https://openai.com/gptbot",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)",
  "Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
];

/** User agents Next's default list handles; the override must not lose them. */
const NEXT_DEFAULT_USER_AGENTS = [
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "AdsBot-Google (+http://www.google.com/adsbot.html)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "LinkedInBot/1.0",
];

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

describe("buildHtmlLimitedBots", () => {
  it("starts with the installed Next's default list, word for word", () => {
    // The option replaces Next's list. A Next upgrade that changes or moves it fails here instead
    // of quietly taking Bing's metadata out of <head>.
    expect(NEXT_DEFAULT_HTML_LIMITED_BOTS).toBe(HTML_LIMITED_BOT_UA_RE.source);
    expect(buildHtmlLimitedBots().source.startsWith(`${HTML_LIMITED_BOT_UA_RE.source}|`)).toBe(true);
    expect(buildHtmlLimitedBots().flags).toBe("i");
  });

  it("catches the AI bots Next's default list does not know", () => {
    for (const userAgent of AI_USER_AGENTS) {
      expect(HTML_LIMITED_BOT_UA_RE.test(userAgent), `Next already knows: ${userAgent}`).toBe(false);
      expect(buildHtmlLimitedBots().test(userAgent), userAgent).toBe(true);
    }
  });

  it("keeps every bot of the default list", () => {
    for (const userAgent of NEXT_DEFAULT_USER_AGENTS) {
      expect(buildHtmlLimitedBots().test(userAgent), userAgent).toBe(true);
    }
  });

  it("leaves a browser on the stream", () => {
    expect(buildHtmlLimitedBots().test(BROWSER)).toBe(false);
  });

  it("adds the app's tokens literally, so a dot matches only a dot", () => {
    const bots = buildHtmlLimitedBots(["Acme.Bot"]);
    expect(bots.test("Mozilla/5.0 (compatible; acme.bot/2.0)")).toBe(true);
    expect(bots.test("Mozilla/5.0 (compatible; AcmeXBot/2.0)")).toBe(false);
  });

  it("ignores blank tokens, which would catch every browser", () => {
    expect(buildHtmlLimitedBots(["", "  "]).test(BROWSER)).toBe(false);
    expect(buildHtmlLimitedBots([" AcmeBot "]).test("AcmeBot/1.0")).toBe(true);
  });
});

describe("the crawler lists", () => {
  it("name search, on-demand and training crawlers apart", () => {
    // Literals, not the module's own constants: dropping a bot must fail here (FIRE L-106).
    expect(AI_SEARCH_CRAWLERS).toEqual(["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "Bingbot", "Googlebot", "Applebot", "DuckAssistBot"]);
    expect(AI_ON_DEMAND_FETCHERS).toEqual(["ChatGPT-User", "Claude-User", "Perplexity-User", "MistralAI-User"]);
    expect(AI_TRAINING_CRAWLERS).toEqual(["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent", "Amazonbot"]);
  });
});
