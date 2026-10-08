# Plan: analytics-pixel-pages

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

A `pixel` step takes `pages` (a list of pathnames or a predicate over the page URL); the endpoint counts a pixel
only from one of those pages. Tests, README, CHANGELOG, analytics 0.1.9.

**Out of scope:** `pages` for beacon steps (a beacon is sent by script on the page itself, prefetch does not run
it); the adopting app's removal of its wrapper.

## Findings (the reading behind the plan)

- `src/server/endpoint.ts`: `readVisit` returns `{ channel, page }`, `page` being the parsed `Referer`; `countStep`
  resolves the step with `findPublicStep(steps, id, via)`. The page is therefore available exactly where the step
  is known, so the check belongs in `countStep`.
- `src/options.ts`: `stepSchema` is `z.strictObject({ id, via })`; the funnel's `superRefine` already reports
  per-step issues with a path. `deriveChannel` (`src/server/channel.ts`) sets the precedent for a hook that
  throws: log `@softure-ai/analytics: <label> failed: <message>` and fall back.
- `tests/endpoint.test.ts` and `tests/wire.test.ts` build requests with a `referer` and `sec-fetch-site`, and read
  counts with `listCounts`; `createTestFunnel(options)` takes any options.

## Key decisions

- **D1** `pages?: readonly string[] | ((page: URL) => boolean)` on a step. Strings are absolute pathnames
  (start with `/`, no `?` or `#`), 1 to 32 of them, compared exactly with `page.pathname` (so `/` is only the
  root; a trailing slash is a different page). A predicate covers dynamic routes (`/blog/…`). The predicate gets
  a copy of the URL, like `channelFromReferer`.
- **D2** Only `pixel` steps take `pages`; the options refuse it on `beacon` and `server` steps with a message on
  `steps[i].pages`, so a misplaced option is a startup error, not a silent no-op.
- **D3** No `Sec-Purpose: prefetch` filter: a prerendered page that is later shown does not request its pixel
  again, so dropping prefetch requests would lose real visits, and the issue's cause need not be a prefetch the
  browser marks. The page check holds whatever loaded the image.
- **D4** A predicate that throws is logged (label `funnel.steps["<id>"].pages`, message only) and counts nothing;
  the answer stays the GIF.
- **D5** Docs: README step description, option table row, configuration example, and a warning that without
  `pages` a link prefetch can count a pixel from another page. CHANGELOG `0.1.9`.

## Phase 1: pixel pages (TDD)

- Tests (`tests/pixel-pages.test.ts`):
  - with `pages: ["/"]`, a landing pixel from `/` (with a tag) counts under the tag; from `/calculator?z=abc`
    and from `/blog/post` it answers the 200 GIF and counts nothing;
  - a predicate `(page) => page.pathname.startsWith("/blog/")` counts from `/blog/a`, not from `/blog` or `/`;
  - a predicate that throws: 200 GIF, nothing counted, one log line naming the step;
  - without `pages` a pixel from any first-party page still counts (backward compatibility);
  - options: `pages` on a beacon or server step, an empty list, a relative path, a path with `?`, a non-function
    non-array are refused with their messages.
- Code: `src/options.ts` (schema, type `FunnelStepPages`), `src/server/endpoint.ts` (`isStepPage`), README (incl. F2, F3),
  CHANGELOG, `package.json` and `module.json` 0.1.9 and the lockfile.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: pixel pages

#### Automated
- [x] 1.1 Pixel pages tests seen red, then green — 24837ca
- [x] 1.2 Gates green (typecheck, lint, test, build) — 24837ca
- [x] 1.3 README, CHANGELOG and version 0.1.9 — 24837ca
