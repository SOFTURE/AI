# Research: seo-crawler-access

Input: change.md, roadmap BL-1, research.sources (`docs/`, FIRE_TRACKER). Depth: normal (no data,
no auth, no money; a public surface whose main failure mode is opening private paths to crawlers).
Snapshot: 77f6319 on `claude/project-thread-c4o57h` (branched from `master`), 2026-10-04 18:40 Europe/Warsaw.
FIRE_TRACKER read at `15ec77e` (shallow clone, read only).

## Summary

- FIRE's SEO surface is ~500 lines in five files; none touches a database. Domain literals are the
  apex host, the IndexNow key, the public path list and the blog paths (`getIndexNowPaths`), and they
  are the only parts that do not move into the package (`getIndexNowPaths` is blog-specific, BL-5).
- Three traps FIRE already paid for and the package must keep as tested rules: `allow: "/"` next to
  `disallow: "/"` opens everything (RFC 9309 tie goes to allow), so the root is written `/$`; a bot
  with a named group ignores the `*` group, so every named group repeats the full allow and disallow;
  `htmlLimitedBots` replaces Next's default list, so the default must be copied and guarded.
- `@softure-ai/core` has no "contributor" hook for other modules beyond privacy and health
  (`foundation/core/src/module.ts:58-71`). The sitemap takes contributors as functions in the seo
  module's own options, which BL-5 fills with a blog contributor; no core change is needed.
- The closest existing module is `@softure-ai/ops`: no database, a route shipped from `/next` and
  mounted with one line, options in zod, `module.json` equal to the manifest.
- Both unknowns are decided below: the IndexNow key is a module option (public by protocol; the app
  may read it from an environment variable itself); the crawler lists are exported data plus an
  `extra` list per category in options, so an app adds a bot without a release.

## Current state

There is no SEO code in this repository (`git grep -i "robots\|sitemap\|indexnow" -- modules foundation
examples` finds nothing but this change's roadmap text). The example app has no `robots.ts`,
`sitemap.ts` or key file (`examples/next-app/app/` listing).

FIRE (read only):

- `src/lib/ai-crawlers.ts:16-50`: three `as const` arrays of robots.txt tokens (7 search, 4 on-demand,
  7 training) and `NAMED_CRAWLERS`, their concatenation. Owner decision there (2026-10-02): all three
  categories allowed.
- `src/lib/ai-crawlers.ts:52-92`: `NEXT_DEFAULT_HTML_LIMITED_BOTS` (the default list of Next 16.3.2,
  copied as a string), 14 AI user-agent tokens, `HTML_LIMITED_BOTS = new RegExp([default, ...ai].join("|"), "i")`.
- `src/lib/ai-crawlers.test.ts:28-35`: the guard imports `HTML_LIMITED_BOT_UA_RE` from
  `next/dist/shared/lib/router/utils/html-bots` and checks the copy is a prefix of the override.
- `src/app/robots.ts:30-100`: `CRAWLABLE_PATHS` (root plus five prefixes), `LANDING_RULE = "/$"`,
  two groups with identical `allow`/`disallow: "/"`, `sitemap` from `APP_PUBLIC_ORIGIN` with a
  hard-coded fallback.
- `src/app/sitemap.ts:57-101`: static entries from `CRAWLABLE_PATHS` with `lastModified: STARTED_AT`
  (server start), a priority map, blog entries from the database; a failing blog read is logged and
  the map is served without it (never a 500).
- `src/lib/indexnow.ts:17-25`: key, key path `/<key>.txt`, endpoint `https://api.indexnow.org/indexnow`;
  `:79-114` `submitToIndexNow(paths, { origin, fetchImpl, timeoutMs })`: empty list → no request,
  one JSON POST with `host`, `key`, `keyLocation`, `urlList`; 200/202 accepted, anything else and a
  thrown fetch become values. No dry run in FIRE: the publish script decides when to call it.
- `public/26227d74da2ace0ce0ae8ad880a95c31.txt`: the key file is a static file.
- `next.config.ts:76`: `htmlLimitedBots: HTML_LIMITED_BOTS`.

Installed Next here: 16.3.8 (root `node_modules/next/package.json`; the example pins `next: 16.3.8`).
Its default list in `node_modules/next/dist/shared/lib/router/utils/html-bots.js` is byte-identical
to FIRE's copy (compared by eye on the full string, and the guard test will compare it mechanically).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| New module | `modules/seo/**` (from `templates/package/`) | the package itself |
| Lockfiles | `package-lock.json`, `examples/next-app/package-lock.json` | new workspace and a new example dependency |
| Example app | `examples/next-app/{softure.config.ts,next.config.ts,package.json,app/robots.ts,app/sitemap.ts,app/indexnow-key.txt/route.ts,e2e/seo.spec.ts,README.md}` | the outcome's e2e |
| Docs | root `README.md` (module list, line 29-30) | the list names every module |
| Repo tests | `tests/repo/packages.test.ts` | runs over every workspace by itself; nothing to edit |

## Data

None. The module has no schema, tables or migrations (`dbSchema: null`, like `modules/ops/module.json`).

## Tests

- Unit: Vitest (`npm test` at the root runs every package's `tests/`). Port FIRE's cases from
  `ai-crawlers.test.ts`, `indexnow.test.ts` (submit part), `robots.test.ts` (rules part, with literal
  expectations, L-106 in FIRE: a guard measuring its own constant measures itself), `sitemap.test.ts`
  (contributor failure, real `lastmod`).
- Network: `submitToIndexNow` takes `fetchImpl`; a dry run must make no call, asserted with a spy.
- Repository: `tests/repo/packages.test.ts` checks the package shape, release rules, README sections
  and dictionaries for every workspace (lines 59-80).
- e2e: `examples/next-app/e2e/*.spec.ts` with Playwright on a built app and Postgres
  (`.github/workflows/e2e.yml`); locally `npm run e2e` per `context/workflow.json`.

## Patterns to follow

- Module factory and manifest: `modules/ops/src/index.ts:15-30`; options as `z.strictObject` with
  hints: `modules/ops/src/options.ts:11-44`; tests that `module.json` equals `toModuleJson`:
  `modules/ops/tests/module.test.ts:8-16`.
- A route shipped from the package and mounted by a one-line re-export:
  `modules/ops/src/next/route.ts:1-40`, reading options with `getSoftureConfig()` + `getModule`.
- Expected failures as values (AGENTS.md "Errors"); FIRE's submit already returns a union.
- Dictionaries `en`/`pl` complete even when small: `modules/ops/src/messages/*.ts`.

## Prior work

- `context/archive/2026-10-02-ops-health-migrate/`: the first module without a database; set the
  route-in-package pattern.
- `context/archive/2026-10-02-next-actions-spike/` (ID-1): route handlers and pages ship from the
  package without `transpilePackages` (docs/02-module-standard.md §8).
- No earlier SEO change in `context/changes/`, `context/archive/` or the git log.

## SOFTURE modules

Not applicable as a provider: no module covers robots, sitemap or IndexNow; this change creates it.
`@softure-ai/core` covers configuration (`defineModule`, `getSoftureConfig`); `@softure-ai/security`
(rate limits) is not needed because every route is a static, input-free GET.

## Risks

- **Opening private paths** (likelihood medium without guards, impact high): `allow: "/"` with
  `disallow: "/"`, or a named group without `disallow`. Mitigation: the builder writes the root as
  `/$` whenever `/` is disallowed, every group carries the same disallow, and tests assert literals.
- **Next changes its default bot list** (low): the guard test fails on a Next upgrade instead of
  quietly dropping Bing's head metadata.
- **IndexNow key file not covering the URLs** (medium): per the protocol a key file covers only URLs
  under its own directory, so the route must sit at the site root; the submit always sends
  `keyLocation`. Mitigation: a root route (`/indexnow-key.txt` by default) and a check that every
  submitted URL is on the canonical host.
- **A failing contributor turns the sitemap into a 500** (low): FIRE logs and serves the rest; keep it.
- **Parallel work**: BL-2 owns `modules/blog/`; both changes edit the root `package-lock.json` (new
  workspaces) and possibly the example app. Master is merged before the PR merges; the lockfile is
  regenerated by `npm install`, not by hand.

## Relevant lessons

`context/foundation/lessons.md` does not exist in this repository. FIRE's lessons cited in its code
apply as priors: L-106 (assert literals, not the module's own constant), L-125 (a public thing goes
on several lists at once: robots, sitemap, canonical).

## Answers to unknowns

1. **Where the IndexNow key lives.** Decided (auto): a module option `indexNow: { key }`, validated
   by the protocol's format (8-128 of `[a-zA-Z0-9-]`). The key is public by protocol (the search
   engine reads it from the site), so it is configuration, not a secret; an app that wants it in the
   environment writes `key: process.env.INDEXNOW_KEY`. Without a key the key route answers 404 and
   the submit returns an error value. Evidence: FIRE keeps it in code (`src/lib/indexnow.ts:5-17`).
2. **Whether the crawler lists ship as extendable data.** Decided (auto): yes. The three lists are
   exported constants (a list update in a minor release is not breaking), and options take
   `crawlers: { search, onDemand, training }`, each `{ enabled, extra }`, so an app adds a bot or
   switches a category off without waiting for a release.
3. **Where the key file is served (implicit).** Decided (auto): a route file in the app,
   `app/indexnow-key.txt/route.ts` re-exporting the package handler, and `keyLocation` sent with
   every submit. A file named after the key (`/<key>.txt`, FIRE) would need a dynamic top-level
   segment or a static file the app writes by hand; the protocol accepts any location under the
   covered directory when `keyLocation` is given (indexnow.org documentation, "keyLocation").
4. **How other modules add sitemap entries (implicit).** Decided (auto): options
   `sitemap: { entries, contributors }`; BL-5 exports a blog contributor the app lists there. Core has
   no generic contributor slot and adding one is out of this change's scope.
5. **What "real lastmod" means for static pages (implicit).** Decided (auto): an entry carries
   `lastModified` only when the app or contributor supplies it; otherwise `<lastmod>` is omitted
   rather than invented (FIRE's server-start date is the build-time signal the roadmap rules out).

## Open questions

All answered or decided above; nothing escalated.

## Decisions (auto)

- Depth `normal`: no data, auth or money; the security risk is covered by literal tests.
- Unknowns 1-5 decided as above, each by the safer and smaller option.
