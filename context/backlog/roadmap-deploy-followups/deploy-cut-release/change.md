---
change_id: deploy-cut-release
title: "A reusable workflow cuts a release from a dispatch"
status: backlog
roadmap_item: DF-12
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

A reusable workflow (with a caller example) that an owner or an agent starts with *Run workflow* on the default branch: it picks the next free date tag (`vYYYY.MM.DD`, then `-2`, `-3`), creates the GitHub Release with an optional description and starts the app's deploy workflow on that tag (a release made with `GITHUB_TOKEN` triggers no workflow by itself).

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-12**:

> - **Outcome:** a reusable workflow (with a caller example) that an owner or an agent starts with *Run workflow* on the default branch: it picks the next free date tag (`vYYYY.MM.DD`, then `-2`, `-3`), creates the GitHub Release with an optional description and starts the app's deploy workflow on that tag (a release made with `GITHUB_TOKEN` triggers no workflow by itself).
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `auto-release.yml` (research §3).

## Constraints

- FIRE_TRACKER is read only; its code may be copied.
- Prerequisite: DF-11.
