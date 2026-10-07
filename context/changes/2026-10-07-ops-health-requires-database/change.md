---
change_id: ops-health-requires-database
title: "/api/health fails its database check when the config has no database"
status: in-progress
roadmap_item: none
issue: "#181"
branch: claude/project-thread-vakmod
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close [issue #181](https://github.com/SOFTURE/AI/issues/181). Apps build their config from the environment
(`database: process.env.DATABASE_URL ? { url } : null`), because `next build` and `--export-migrations` run without a
database (#155). When the config ends up with `database: null` at run time (a missing secret, a typo in compose),
`GET /api/health` collects no `database` check; with no module check and no app check it runs zero checks and
answers **200 `{"status":"ok"}`**, so the platform keeps routing traffic to an app whose pages fail.

After this change:

- `ops()` takes `requireDatabase` (default `true`). With it, a config without a database adds a `database` check that
  fails with `ops.database_missing`: the route answers 503, `detail: "checks"` shows `database: "failed"`, and the
  log line names the cause.
- An app that really has no database sets `ops({ requireDatabase: false })` and keeps today's behaviour (module and
  app checks only).
- Tests pin the zero-check case: no database and the default → 503; `requireDatabase: false` and no other check →
  200 with no checks, a deliberate opt-out.
- The ops README documents the option and the log line.

Done when (from the issue): a config without a database no longer reports healthy by default, and a test pins the
zero-check case.

## Context

`defineSoftureConfig` already refuses `database: null` when an enabled module has a `dbSchema`
(`foundation/core/src/config.ts`, `checkDatabase`), so the issue's first variant ("default `true` when a module has
a `dbSchema`") would never fire: the configs that reach the route with `database: null` are exactly the ones whose
modules have no schema (FIRE_TRACKER's case: the app's own tables). The default must therefore be `true` without
condition. The second variant (zero checks → `unavailable`) would not catch an app whose modules contribute a check
(the check passes, the database is still missing), and would turn a no-database app's route red with no way out.

An empty URL (`{ url: "" }`) already fails: the route opens the database and the open throws, so the check is
`failed`. Only `null` slipped through.

Research is skipped: the issue measures the behaviour and the code path is one function.

## Constraints

- Neutral wording in the repository and on GitHub.
- No release in this change.
- Other changes run in parallel; this one touches only `modules/ops` and its context folder.
