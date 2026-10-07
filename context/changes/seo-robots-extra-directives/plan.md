# Plan: seo-robots-extra-directives

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

An app sets `robots.other` in `seo({ ... })` and every group of its `robots.txt` carries those lines; the README tells
an app that signs requests to pass a signing fetch as `fetchImpl`. seo 0.1.6.

**Out of scope:** a dedicated `contentSignal` option with typed fields (the issue offers it as an alternative; a
generic map covers it and any later directive), per-group values, the adopting app's own migration.

## Findings (the reading behind the plan)

- `buildRobots` returns up to three groups: `*`, the named crawlers of enabled categories (same allow/disallow), and
  the crawlers of switched-off categories with `Disallow: /`.
- A crawler with a group of its own ignores the `*` group (RFC 9309 §2.2.1), so a line written only under `*` would not
  reach a named bot. That is why the adopting app repeats `Content-Signal` in every group.
- Next's serializer (`resolveRobots`) writes `other` entries after allow/disallow, one `key: value` line per value of
  an array. It does not escape anything: a value with a newline would start a new line of the file.
- `submitToIndexNow` already accepts `fetchImpl?: typeof fetch`; the JSDoc says nothing about its purpose.

## Key decisions

- **D1** option `robots.other: Record<string, string | string[]>`, default `{}`, copied into **every** group,
  including the group that closes switched-off categories. Same reason as the repeated disallow: a named crawler reads
  only its own group. An app that wants different values per group is out of scope (no request for it).
- **D2** `other` is added to a group only when the map has an entry, so the default output and every existing test
  stay identical.
- **D3** validation at the boundary (zod, startup): a key is a robots.txt field name (`^[A-Za-z][A-Za-z0-9-]*$`); the
  module's own fields `user-agent`, `allow`, `disallow` and `sitemap` are refused case-insensitively (the module owns
  them, a second `Sitemap` or `Allow` here would bypass the rules above); a value is a non-empty string without CR or
  LF (no line injection into the file); an array has at least one value.
- **D4** `RobotsRule` gains `readonly other?: Record<string, string | string[]>`, the same shape as Next's.
- **D5** point 2: JSDoc on `fetchImpl` ("pass a signing fetch here, e.g. for web-bot-auth") and one README paragraph
  with a short example wrapping `fetch`.
- **D6** CHANGELOG entry 0.1.6, version bump in `package.json`.

## Phase 1: option, groups, docs (TDD)

- Tests (`tests/robots.test.ts`): `other` set → every group (all three when training is off) carries the same `other`;
  default → no group has an `other` key. (`tests/module.test.ts`): the schema accepts `Content-Signal` with a
  string and with an array; refuses `Allow`, `sitemap`, `User-Agent` (any case), a key with a space or a colon, an
  empty value, a value with `\n`, an empty array. (`tests/next.test.ts`): `robots()` carries the option through the
  registered config.
- Code: `src/options.ts`, `src/robots.ts`, `src/server/indexnow.ts` (JSDoc), `README.md`, `CHANGELOG.md`,
  `package.json`.

Done when: the new tests were seen red, then green; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
green.

## Progress

- [ ] Phase 1: option, groups, docs
