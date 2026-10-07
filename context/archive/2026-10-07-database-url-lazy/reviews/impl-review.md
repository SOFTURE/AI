# Implementation review: database-url-lazy

Reviewed: commit 728f7cb against `plan.md` (Phase 1), `change.md` and `reviews/plan-review.md`. Mode: autonomous.

Verdict: **approve**. No blocking finding; one note on scope, nothing to fix.

## Plan conformance

| Plan item | Where | State |
| --- | --- | --- |
| Schema accepts `database.url: ""` and keeps it (also with `dbSchema` modules) | `foundation/core/src/config.ts` | done |
| JSDoc on `SoftureConfig.database` | same | done |
| `createDatabase("")` refuses with the empty-URL message | `foundation/db/src/client.ts` | done |
| `softure migrate` with `""` exits 1 with that message; `--export-migrations` with a config built by `defineSoftureConfig` exits 0 (plan review #1) | `foundation/db/tests/cli.test.ts` | done |
| Docs: core README §3, db README §4, docs/02 §7 `?? ""` | the three files | done |

Outside the plan's file list, two existing tests asserted the old refusal and were updated to the new contract:
`foundation/core/tests/cli.test.ts` (a default load now keeps `{ url: "" }`) and `modules/blog/tests/cli.test.ts`
(`softure-blog publish` now fails at the connection with the empty-URL message instead of at the config import).
Both are the behaviour this change intends; no source outside `core` and `db` changed.

## Verification

- Red first: the five new or changed cases in `config.test.ts`, `client.test.ts` and `cli.test.ts` failed on the old
  code (the config threw `database.url: must not be empty`; `createDatabase("")` said `scheme (none)`); green after.
- Gates: `npm run typecheck`, `npm run lint`, `npm run build` exit 0; `npm test` 303 files passed, 6 skipped
  (4163 tests passed, 71 skipped).
- Issue's paths, measured with `DATABASE_URL` unset against the built packages: a config with `security` and `auth`
  and `database: { url: process.env.DATABASE_URL ?? "" }` defines fine (`{"url":""}`), `runMigrateCli
  --export-migrations` exported the five SQL files with exit 0, and a plain `runMigrateCli` exited 1 with
  `softure migrate: createDatabase: the database URL is empty; set database.url in softure.config (usually from
  DATABASE_URL)`. `registerSoftureConfig` + `getSoftureConfig` (what the root layout runs during `next build`) also
  evaluate without error. A full `next build` of the example app was not run: it keeps its local fallback URL, and
  the build fails only through the config's evaluation, measured above.

## Findings

1. **Note: a runtime without `DATABASE_URL` no longer fails at import.** It now fails at the first query, and the
   ops health route answers `503` (`database: failed`), which deploy verification reads. Accepted in the plan
   (key decision "lazy"); no change.

## Security

The empty-URL message carries no URL; the scheme-error path is unchanged (still names the scheme only).
