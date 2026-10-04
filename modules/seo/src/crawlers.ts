// The crawlers an app names in robots.txt, and the bots that get metadata in <head> instead of a
// stream. Shipped as data: adding a bot to a list is a minor release, and an app adds its own
// through `seo({ crawlers: { <category>: { extra } } })` without waiting for one.
//
// The names are robots.txt tokens, not full User-Agent headers: providers document them that way
// (developers.openai.com/api/docs/bots, support.claude.com/en/articles/8896518). The three
// categories stand apart because providers control them apart (OpenAI: `OAI-SearchBot` for search
// results, `ChatGPT-User` for fetches a user asked for, `GPTBot` for training), so closing one is
// switching off one list, not searching through names.

/** Crawlers that build search indexes, AI answers with citations among them. */
export const AI_SEARCH_CRAWLERS = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Bingbot",
  "Googlebot",
  "Applebot",
  "DuckAssistBot",
] as const;

/** Fetches on demand: an assistant reads a page because someone asked about it. */
export const AI_ON_DEMAND_FETCHERS = ["ChatGPT-User", "Claude-User", "Perplexity-User", "MistralAI-User"] as const;

/** Crawlers that collect text for model training. */
export const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
] as const;

/**
 * Next's default `htmlLimitedBots` (`HTML_LIMITED_BOT_UA_RE` in
 * `next/dist/shared/lib/router/utils/html-bots`), copied because the `htmlLimitedBots` option
 * replaces the default instead of extending it: without the copy, Bingbot and Google's crawlers
 * would lose the metadata in <head>. A test compares this copy with the installed Next, so an
 * upgrade that changes or moves the list fails there instead of quietly.
 */
export const NEXT_DEFAULT_HTML_LIMITED_BOTS =
  "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight";

/** AI bots that do not run JavaScript, added to Next's list. */
export const AI_HTML_LIMITED_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
] as const;

/**
 * The `htmlLimitedBots` value for `next.config.ts`: Next's default list, the AI bots and the app's
 * `extra` tokens (matched literally, case-insensitive). These bots get the metadata blocking, in
 * <head>, instead of streamed into <body>, which they may never read.
 */
export function buildHtmlLimitedBots(extra: readonly string[] = []): RegExp {
  const tokens = [...AI_HTML_LIMITED_BOTS, ...extra].map(escapeRegExp);
  return new RegExp([NEXT_DEFAULT_HTML_LIMITED_BOTS, ...tokens].join("|"), "i");
}

function escapeRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
