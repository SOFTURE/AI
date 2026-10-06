---
change_id: deploy-fire-parity
title: "The deploy CLI matches FIRE_TRACKER where FIRE's behaviour is generic"
status: archived
roadmap_item: DF-1
branch: claude/project-thread-sxdn77
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

FIRE_TRACKER's release scripts (`render-env-prod`, `release-notes`, the release and auto-release workflows, the SSH
gateway, `docker/server/deploy.sh`, `verify-production.sh`) are read side by side with `@softure-ai/deploy`. Every
behaviour that is generic and lives in the CLI is ported with its test cases; every generic behaviour that lives in
a file another item owns right now (`deploy-app.yml`, `init`'s `deploy.sh`) is recorded as a new roadmap gap; the
rest is listed as FIRE-specific in the package README, with the reason. A reader of the README can tell, for each of
FIRE's steps, whether the package does it, a gap tracks it, or it stays in the app.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-06-2-roadmap.md) (deploy-followups), item **DF-1**; the taken backlog entry is kept as
[`backlog-input.md`](backlog-input.md).

> - **Outcome:** FIRE_TRACKER's `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`,
>   their tests and `.github/workflows/release-opis.yml` are read; every behaviour and test case that is generic is
>   ported into `tools/deploy` (report format, env edge cases), and the rest is listed as FIRE-specific in the
>   package README. The same for the deploy workflow (DP-2) … and the forced-command protocol … is aligned with FIRE's
>   gateway. The same for `docker/server/deploy.sh` against DP-3's `backup`, `schema-guard` and `row-counts` … The
>   same for `verify` (DP-4) against `scripts/verify-production.sh`.
> - **Unknowns:** whether FIRE's report groups entries differently (by type or label) than DP-1's two sections.

FIRE_TRACKER was added to the project's repositories on 2026-10-06 (read only); this session reads it at
`7aad63a`.

## Constraints

- Owns `tools/deploy/src/env/`, `src/notes/`, `src/db/backup.ts`, `src/verify/` (with DF-5, which adds a schema key
  and owns `src/db/row-counts.ts`) and the package README.
- Does not edit `.github/workflows/deploy-app.yml` or `templates/docker/server/deploy.sh.tmpl`: DF-7 changes both in
  parallel (lane A). Their differences from FIRE become new gaps that follow DF-7.
- FIRE_TRACKER is read only: nothing is pushed there. English-only code, comments and commits.
- `@softure-ai/deploy` 0.1.2 is not published yet (DF-6 bumped it), so this change rides 0.1.2.

## Notes

- Placement: main roadmap deploy-followups, item DF-1 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`): the side-by-side reading is the item itself.
- Framing skipped: the roadmap item fixes what to build (port or record each difference); the only open question,
  where each difference goes, is answered per row in `research.md` §6 and does not change whether to build.
- Archived 2026-10-06: `env render` writes optional compose names and a header line; `release-notes` takes `--body`
  (its own section of a release body) and `--roadmap` (the `done_code` items); `backup` takes `--exclude-table-data`
  and `--max-age-days` and refuses a file without the `PGDMP` header; `verify` routes take `method`, `body` and
  `requestHeaders`. New gaps DF-9…DF-13 (after DF-7). Waiting: the release of `@softure-ai/deploy` 0.1.2.
