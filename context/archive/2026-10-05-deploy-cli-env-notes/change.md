---
change_id: deploy-cli-env-notes
title: "A deploy CLI renders .env.prod from secrets and writes release notes between two tags"
status: archived
roadmap_item: DP-1
branch: claude/project-thread-jy3jla
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

An app that deploys to one VPS installs `@softure-ai/deploy` and gets a `softure-deploy` CLI with two commands:

- `softure-deploy env render` reads the required names (`${NAME:?…}`) from the production compose file and writes
  `.env.prod` from the process environment (CI secrets). A missing name stops it with the list of missing names;
  no value is ever printed.
- `softure-deploy release-notes` prints the release report between two tags (merged pull requests and direct
  commits, with links), ready to post on a GitHub Release.

A reviewer can check both with the package tests: fake names and values for env, a temporary git repository with
tags for the notes.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy), item **DP-1**:

> - **Outcome:** A new package `@softure-ai/deploy` (`tools/deploy/`, a CLI like marketing-kit) with:
>   - `softure-deploy env render`: reads required names from `${X:?}` in the production compose file and writes `.env.prod` from the environment, refusing a missing name and never printing values;
>   - `softure-deploy release-notes`: the release report between two tags from commits and merged pull requests, in the format FIRE's release workflow posts.
> - **Unknowns:** Whether release notes read the GitHub API (token in CI) or only `git log` with merge commits.
> - **Baseline:** FIRE `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts` and tests. After: the same tests green in the package; bash replaced by TS.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The split between package and app
(owner, 2026-10-04) is in [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) ("Deploy: package or
template"). The earlier ops research called these two scripts app-specific
([`ops-health-migrate/research.md`](../../archive/2026-10-02-ops-health-migrate/research.md), answer 1); the owner's
2026-10-04 split moves them into the package with the app's names as input.

## Constraints

- Exclusively owns: the `tools/deploy/` scaffold, `src/env/`, `src/notes/`, and the CLI entry `src/cli/` (DP-2…DP-4
  add their own command files to it later).
- English-only code, comments and commits; release-report copy in `pl`/`en` message dictionaries.
- No release, tag or publish (DP-8 is the owner's). Nothing touches a server, a secret or DNS.
- FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy, item DP-1 (taken from `context/backlog/roadmap-deploy/`).
- Research: done (`research.md`), short: the inputs are the roadmap, the repository's CLI pattern and the
  compose and dotenv rules.
- Framing skipped: the problem is fixed by the owner's roadmap item and split decision (2026-10-04); nothing about
  whether to build it is in doubt.
- DF-1 (`deploy-fire-parity`) opened the queued catch-all `deploy-followups` for the unchecked FIRE_TRACKER parity.
- Archived 2026-10-05: `@softure-ai/deploy` ships `softure-deploy env render` and `release-notes`, waiting for its first publish (DP-8).
