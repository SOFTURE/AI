---
change_id: adoption-gaps-ops-switches-deploy-core
title: "ops, feature-switches, deploy, core: adoption gaps, CHANGELOGs and README drift (issue #158)"
status: archived
roadmap_item: null
issue: 158
branch: claude/project-thread-e71n3t
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close all thirteen points of issue [#158](https://github.com/SOFTURE/AI/issues/158), found while planning an app's
switch to the packages: the ops database recipes for an app that owns `public` and its own migration ledger, ledgers
the app role can write, secrets passed on argv, the health route's `dynamic`, migrate docs drift, a one-way switch
override, deploy steps that need Node on the host, missing `dependsOn` entries, CHANGELOG files and stale README
lines. Then release every package whose version on master is not on npm.

A reviewer checks the tests named in `plan.md`, the recipes (run against Postgres 16 in the impl review), the
CHANGELOGs, the README sections and the versions.

## Context

The issue, point by point:

1. ops `recipes/existing-database.sql` skips `public` and hands every other schema, the app's `drizzle` ledger
   included, to `softure_migrator`; `01-roles.sql` cannot reuse an existing role (`CREATE ROLE` without a guard).
2. The app role can write `softure.migrations` (global default privileges) and, after `existing-database.sql`,
   `drizzle.__drizzle_migrations`. Revoke and assert it in the container run.
3. Ops scripts take secrets through argv only (shell history, `docker exec` argv).
4. The health route relies on Next's default for `dynamic`.
5. Docs: two different export commands (ops README vs db README), no word on a config importing `server-only` or
   path aliases, and the compose example's password variable names differ from §6.
6. feature-switches: the environment override works both ways; an app needs it to work towards the fail mode only.
7. deploy: the schema guard and backup run `npx @softure-ai/deploy` on the host; a host without Node cannot run them.
8. deploy 0.1.3 is not on npm (0.1.1 lacks `backup --exclude-table-data` and `--max-age-days`); README names
   `/app/migrations` where the image holds `/app/softure-migrations`.
9. core `safeError` has no way to let a deliberate domain message through.
10. core `selectPlural` builds `Intl.PluralRules` on every call.
11. `waitlist/module.json` omits `auth`; `auth/module.json` omits `ops`; nothing checks manifests against package deps.
12. No package has a `CHANGELOG.md`, while docs/05 "Definition of done" asks for a "verified in" note there.
13. Stale READMEs: core and db (already fixed on master by #160), testing (first-release line, `setupFiles` note).

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; text in the repo and on GitHub stays neutral ("an adopting app").
- Backward compatible: every new option is optional and keeps today's behaviour by default; recipes keep working
  unchanged on an empty cluster.
- `foundation/db` is also changed by the parallel change for issue #179 (drivers as optional peers); this change does
  not touch db code, only its README, so the two merge cleanly.
- Versions: unreleased bumps on master stay (core 0.1.6, db 0.1.6, auth 0.1.7, feature-switches 0.1.6, waitlist 0.1.6,
  billing 0.1.6, deploy 0.1.3 and the rest); packages changed since their last tag without a bump get one (ops, analytics,
  testing). After the merge the thread releases every package whose version is not on npm (after #179, if it is
  still open then).

## Process notes

- Research: skipped as a separate artefact. The issue names every file and line; the reading needed (recipes,
  ops-script, route, env-override, safe-error, i18n, manifests, deploy.sh template and its tests) is summarised in
  `plan.md` § Findings.
- Framing: skipped. Every point is a concrete gap with the observed effect and a proposed direction in the issue;
  the plan records the one decision per point.
