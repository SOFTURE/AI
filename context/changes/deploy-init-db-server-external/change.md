---
change_id: deploy-init-db-server-external
title: "deploy: init warns when a database app's next.config lacks @softure-ai/db in serverExternalPackages (issue #184)"
status: impl_reviewed
roadmap_item: null
issue: 184
branch: worktree-agent-a14cdabdead11e3b2
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Intent

An app with the database part on (`@softure-ai/db` in `package.json`) whose `next.config.*` does not name
`@softure-ai/db` in `serverExternalPackages` gets a warning from `softure-deploy init`, next to the existing
`standalone` warning, that names the missing entry and points to the `@softure-ai/db` README. The author learns it
before `next build` fails in CI with `Can't resolve '@electric-sql/pglite'` (or `pg`).

A reviewer checks the new cases in `tools/deploy/tests/init-cli.test.ts`, the README line and the version bump
(deploy 0.1.4).

## Context

Issue [#184](https://github.com/SOFTURE/AI/issues/184), verbatim:

> Found while working on #179.
>
> Since #179, `pg` and `@electric-sql/pglite` are optional peers of `@softure-ai/db`. A Next.js app has to list
> `@softure-ai/db` and its driver in `serverExternalPackages` (db README §2). Without it, `next build` fails with
> `Can't resolve '@electric-sql/pglite'` in an app that installs only `pg` (or the reverse), because the bundler
> resolves both drizzle adapters.
>
> `softure-deploy init` already reads `next.config.*` and warns when `output: "standalone"` is missing. It could do
> the same when the database part is on (`@softure-ai/db` in package.json) and `serverExternalPackages` does not
> name `@softure-ai/db`.
>
> ## Done when
>
> - `init` prints a warning naming the missing entry and the db README section, next to the existing `standalone`
>   warning.
> - A test covers a config with the entry, without it, and an app without `@softure-ai/db`.

Known state: `tools/deploy/src/init/app-facts.ts` reads `package.json` and the first `next.config.*`;
`tools/deploy/src/cli/init-command.ts` `listWarnings` prints the `standalone` warning. #179 is in flight in PR #185
(not merged); on master the db README §2 "Installation" still says the drivers are regular dependencies, so the
section on `serverExternalPackages` that #185 adds is not visible from this branch.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- Only `tools/deploy` changes (source, tests, README, version) plus this change's `context/` folder. Not
  `foundation/db` (owned by #179 / PR #185), not `examples/next-app`.
- Backward compatible: `AppFacts` is exported, so a new field is optional; existing warnings keep their text.
- Bumps `@softure-ai/deploy` 0.1.3 → 0.1.4; releasing stays with the owner.
- English only.

## Notes

- Placement: unlinked (`roadmap_item: null`, `issue: 184`), per the project rule that each GitHub issue is one change.

## Process notes

- Research: skipped as a separate artefact. The issue names the files (`init` reading `next.config.*`, the
  `standalone` warning); the reading needed (`app-facts.ts`, `init-command.ts`, `init-cli.test.ts`, the deploy
  README "init" section, db README §2) is summarised in `plan.md` § Findings.
- Framing: skipped. The issue states the failure, the trigger and the done criteria.
