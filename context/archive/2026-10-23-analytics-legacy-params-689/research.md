# Research: legacy names of the channel parameter (issue #689)

## Current state (master 432f38a, analytics 0.2.1)

- `channel.param` (default `z`) is read in: `server/channel.ts` `readChannel` (request URL, then a first-party
  `Referer`), `hasChannelParam`; `next/channel.ts` `getChannelFromSearchParams` (a `URLSearchParams` or a page's
  record); `client/channel-keeper.ts` (`ChannelRule.param`, remembers and re-adds it, `tagLink`);
  `proxy/index.ts` `readRequestChannel` checks `url.searchParams.has(param)` and `page.searchParams.has(param)`
  directly; `server/endpoint.ts` reads the page through `readChannel`.
- Written in: `withChannel` (used by `tagPath`, the tagger's `carry` and `tag`), the keeper (`set(rule.param)`).
- `getChannelRule` hands the browser `{ param, pattern, flags, maxLength, normalize, origins }`;
  `ChannelKeeperClient` rebuilds the keeper from these fields and lists them as effect dependencies.
- `funnel.wire.channelField` is one name or `null`; `stepFields` is a list of 1 to 4 names, each once, where one
  value in all counts and two count nothing (`readStep`).

## Findings

- One browser-safe helper in `channel-rule.ts` (it imports nothing at runtime) can pick the deciding raw value from a
  `URLSearchParams` given the ordered names (`param`, then each legacy name): the first name present decides,
  valid or not, which keeps the existing rule "a URL with the parameter decides".
- `withChannel` is the single writer on the server; if it also deletes the legacy names, `tagPath`, `carry` and the
  tagger's rename redirect all write `param` only.
- The tagger's `tag` returns early when the URL has the parameter. A URL with only a legacy name needs a rename
  redirect instead: 307 to the same URL with the legacy name replaced by `param`, when its value is valid.
- The keeper runs on every navigation and changes the address with `replaceState` (no request), so it can also
  drop a legacy name when `param` is present.
- `channelField` as a list: the endpoint takes the channel when exactly one value appears across the fields, the
  same rule as `stepFields`.
