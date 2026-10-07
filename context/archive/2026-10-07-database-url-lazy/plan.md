# Plan: database-url-lazy

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

- `defineSoftureConfig` accepts `database: { url: "" }` and keeps it as is (also with modules that have a
  `dbSchema`); a missing or `null` `database` with such modules is still refused at definition.
- `createDatabase("")` throws `createDatabase: the database URL is empty; set database.url in softure.config
  (usually from DATABASE_URL)`, so every connection path (shared handle, `softure migrate`, ops scripts and health
  route, module CLIs) names the fix.
- `softure migrate --export-migrations` works with an empty URL (it already never connects; the config no longer
  throws on import).
- Docs: core README §3 states that an empty URL is accepted and refused on first connection; db README §4 says the
  build step needs no `DATABASE_URL`; docs/02 §7 uses `?? ""` instead of `!`.

**Out of scope:** an `undefined` URL (`DATABASE_URL!`): TypeScript types `url` as `string`, so the documented form
is `?? ""`; `withDatabaseOptional` stays as it is (blog check reads an empty URL as `null`); any change to the
example app (its fallback URL is a dev convenience, not a workaround any more).

## Approach

Option A of the issue: validate the URL lazily. The schema drops `.min(1)` for `database.url`; the empty check
moves into `createDatabase`, the single function every connection goes through.

## Key decisions

- **Lazy, not a build-phase flag.** The alternative (load the config "database optional" on build paths) needs
  each path to know it is a build: `NEXT_PHASE` sniffing for `next build`, a dynamic import for the app script.
  Both are fragile and do not cover other bundlers or tools. An empty URL is the one value only the runtime can
  fill, so it is the one check that moves; every other check stays at definition.
- **Keep `{ url: "" }`, not `null`.** `null` means "this app has no database" and makes adapters answer "no
  database configured"; an empty URL means "configured, value not present in this process". Adapters already pass
  the URL on to `getSharedDatabase`, which now explains the empty value.
- **The check lives in `createDatabase`**, not in each adapter: one place, one message, and `getSharedDatabase`
  drops a failed open, so a later call with a real URL still works.
- **No version bump**: releases bump every package together (`release-0-1-*` changes).

## Phase 1: lazy database URL (TDD)

- `foundation/core/tests/config.test.ts`: the `database.url` case leaves the "reports each invalid field" table;
  new case "accepts an empty database url, also with a database schema, and keeps it"; the optional-database test
  that expected `database.url: must not be empty` after the load now expects `{ url: "" }`.
- `foundation/db/tests/client.test.ts`: `createDatabase("")` rejects with the empty-URL message.
- `foundation/db/tests/cli.test.ts`: `softure migrate` with `{ url: "" }` exits 1 with that message;
  `--export-migrations` with a config built by `defineSoftureConfig({ database: { url: "" }, … })` exits 0
  and writes the files (built through the real schema, so the case is red on the old code; plan review #1).
- `foundation/core/src/config.ts`: drop `.min(1)`; JSDoc on `SoftureConfig.database` says an empty URL is refused
  when connecting.
- `foundation/db/src/client.ts`: empty-URL check before the scheme checks.
- Docs as in Goal.

Done when: the new tests were seen red on the old code, then green; `npm run typecheck|lint|test|build` green;
the issue's two paths measured on the branch: an app script with `DATABASE_URL` unset runs
`--export-migrations` (exit 0), and the example app's `next build` with the config's fallback replaced by `?? ""`
gets past config evaluation (done by importing the config with `DATABASE_URL` unset if a full build is too heavy).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: lazy database URL

#### Automated
- [x] 1.1 Tests seen red, then green — 728f7cb
- [x] 1.2 Config, client and docs changed — 728f7cb
- [x] 1.3 Gates green (typecheck, lint, test, build) — 728f7cb

#### Manual
- [x] 1.4 Issue's build paths measured with DATABASE_URL unset — 728f7cb
