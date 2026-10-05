---
change_id: deploy-cli-env-notes
title: "Deploy CLI: env rendering and release notes"
status: backlog
roadmap_item: DP-1
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/deploy` CLI: `env render` from secrets (names from the compose file), release notes as a live report.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy), item **DP-1** (main roadmap since 2026-10-05):

> ### DP-1: Deploy CLI: env rendering and release notes
> - **Change ID:** `deploy-cli-env-notes`
> - **Status:** ready
> - **Outcome:** A new package `@softure-ai/deploy` (`tools/deploy/`, a CLI like marketing-kit) with:
>   - `softure-deploy env render`: reads required names from `${X:?}` in the production compose file and writes `.env.prod` from the environment, refusing a missing name and never printing values;
>   - `softure-deploy release-notes`: the release report between two tags from commits and merged pull requests, in the format FIRE's release workflow posts.
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:** Whether release notes read the GitHub API (token in CI) or only `git log` with merge commits.
> - **Risk:** low.
> - **Baseline:** FIRE `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts` and tests. After: the same tests green in the package; bash replaced by TS.
> - **PRD refs:** FR-33, NFR-5.
> - **Source (FIRE_TRACKER, read only):** `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`, `.github/workflows/release-opis.yml`

Reference material: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `tools/deploy/` scaffold, `src/env/`, `src/notes/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
