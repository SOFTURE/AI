---
change_id: ops-health-requires-database
reviewed: c148f10
date: 2026-10-07
verdict: approved
---

# Implementation review: ops-health-requires-database

Checked the diff against `plan.md` and the issue's "Done when".

- **Done when, issue:** a config without a database no longer reports healthy by default: `route.test.ts`
  "answers 503 when the config has no database, even with no other check" (503, `{ database: "failed" }`, log line
  `health check "database" failed: ops.database_missing`). The zero-check case is pinned both ways: that test, and
  "answers 200 with no checks when the app opts out of a database and has nothing else to check".
- **TDD:** the new tests ran red before `src/` changed (11 failures: unknown option, missing `database` check), green
  after.
- **D1–D4** hold: `requireDatabase` defaults to `true` without condition; the missing check goes through the same
  runner as every other check, so module and app checks still run and `detail: "checks"` lists them; the check sits
  in `collectHealthChecks` (also when ops is absent from the config); the code is `ops.database_missing`.
- **Behaviour change:** an app with `ops()` and no database now answers 503 until it sets
  `ops({ requireDatabase: false })`. README §3 and §4 say so; to be named in the release notes.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm test` green.

No findings.
