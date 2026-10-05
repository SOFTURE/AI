# Plan: blog-publish-cache-refresh

Input: change.md, research.md. Complexity: medium (2 phases). Risk: low (a new opt-in route and one more
request after a committed publish; no schema change).

## Goal

- `refreshBlogCache` from `@softure-ai/blog/next`, mounted by the app as `POST` at `routes.refresh`
  (`/api/blog/refresh` by default): checks `Authorization: Bearer <BLOG_REFRESH_SECRET>` and calls
  `revalidateTag("softure-blog", { expire: 0 })`. Rate-limited per client address through `security()` in the
  `blog-refresh` bucket (`BLOG_RATE_LIMIT_BUCKETS`), counted before the secret is checked.
  Answers: 204 refreshed; 401 (with `www-authenticate: Bearer`) for a missing or wrong secret; 400 for an
  unidentified client; 429 with `retry-after`; 503 when counting fails; 500 with a log line naming the
  variable when `BLOG_REFRESH_SECRET` is missing or shorter than 32 characters. A missing security module or
  bucket is a setup error, thrown by name (as mcp-access does).
- `requestBlogRefresh(config, changes, options)` (root entry, beside `submitBlogChanges`): the client side,
  returning `not_configured` (no secret), `skipped` (no text changed), `dry_run` (the URL a commit would
  call), `refreshed` or `failed` (reason and code). Never throws for an expected failure.
- `softure-blog publish --commit` calls it after a done run and before the IndexNow submit; `--app-url
  <origin>` overrides `appOrigin` for that request. Lines: `cache: refreshed <url>`; without the secret
  `cache: the running app shows the change after revalidateSeconds (<n> s); set BLOG_REFRESH_SECRET …`; a
  failure is a `warning cache: …` line and keeps exit code 0 (the publish is written).
- Manifest: route `refresh`, env `BLOG_REFRESH_SECRET` (optional), the mount, and `security` as an optional
  dependency (`^0.0.0?`); `@softure-ai/security` an optional peer, reached through a dynamic import.
- The example app mounts the route and sets a test secret for the e2e server; a serial e2e spec publishes a
  changed body with the command and sees it on the page at once, then restores the fixture.
- Blog README: the refresh section (setup, answers, one-instance limitation); §12's line replaced by the
  multi-instance limitation.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Next call | `revalidateTag(tag, { expire: 0 })` | `"max"` serves the stale page once more; one argument is deprecated | research 1 |
| Rate limit | security bucket `blog-refresh` (10 per 15 min per address), optional dependency | the repository's limiter; an app without the route needs no security | research 3 |
| Secret | one env variable, read by the route and the command; Bearer; SHA-256 + `timingSafeEqual`; at least 32 characters | one line of setup; no timing leak; a short secret is a setup bug | research 4 |
| Address | `appOrigin + routes.refresh`, `--app-url` overrides the origin | the config knows both; a container may need a private name | research 5 |
| Redirects | `redirect: "manual"`; a 3xx is a failure naming the status | never follow with the secret to another address | — |
| Order | refresh, then IndexNow | the crawler that answers the ping must find the new page | change.md |
| `--no-indexnow` | does not skip the refresh | the flags are independent; the e2e fixtures run without a secret anyway | — |

Rejected: a `blog({ refresh: { url } })` option (the URL is the app's own origin, already in the config);
an in-memory limiter in the blog (does not hold across instances; the repository has one limiter);
`revalidatePath` per changed path (the tag already covers every cached read and the pages built on them).

## Phase 1: Route and client

**Discipline:** TDD (route and client tests first).

- `modules/blog/src/discovery/refresh.ts` (client, env name, minimum length, bucket name and defaults).
- `modules/blog/src/next/refresh.ts` (`refreshBlogCache`), `src/next/index.ts`, `src/next/next-modules.d.ts`
  if needed, `src/index.ts` (manifest, `BLOG_RATE_LIMIT_BUCKETS`, `requestBlogRefresh` export).
- `modules/blog/package.json` (optional peer and dev dependency on `@softure-ai/security`), `package-lock.json`.
- Tests: `tests/next/refresh.test.ts`, `tests/discovery/refresh.test.ts`, `tests/module.test.ts`.

## Phase 2: Command, example and docs

**Discipline:** TDD for the command; the e2e spec proves the outcome on the built app.

- `modules/blog/src/cli/run.ts` (`--app-url`, `env`, `refreshFetch`, the `cache:` line), `tests/cli.test.ts`.
- `examples/next-app`: `app/api/blog/refresh/route.ts`, `softure.config.ts` (bucket), `playwright.config.ts`
  and `e2e/outbox.ts` (test secret), `e2e/blog-refresh.serial.spec.ts`.
- `modules/blog/README.md`.

## Risks and rollback

No migration. Rollback: revert the commits; the app then shows a publish after `revalidateSeconds` again.
An app that mounted the route keeps a dangling import until it removes the route file.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Route and client

#### Automated
- [ ] 1.1 Route tests in `tests/next/refresh.test.ts` and client tests in `tests/discovery/refresh.test.ts` pass
- [ ] 1.2 Gates green (typecheck, lint, test, build)

### Phase 2: Command, example and docs

#### Automated
- [ ] 2.1 Command tests in `tests/cli.test.ts` pass
- [ ] 2.2 `e2e/blog-refresh.serial.spec.ts` passes on the built example
- [ ] 2.3 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 2.4 Impl review recorded in `reviews/impl-review.md`
