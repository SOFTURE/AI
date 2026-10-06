---
change_id: deploy-release-report
title: "The release body carries pipeline status and deployment history"
status: backlog
roadmap_item: DF-10
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

A final report job of `deploy-app.yml` writes, with `release-notes --body` (DF-1), a pipeline status table (each job's result and the run link) and a deployment history row per run (time, result, image and digest, backup file, row counts before and after, verify result) into the GitHub Release body, newest first; reruns and rollbacks add rows, never replace them.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-10**:

> - **Outcome:** a final report job of `deploy-app.yml` writes, with `release-notes --body` (DF-1), a pipeline status table (each job's result and the run link) and a deployment history row per run (time, result, image and digest, backup file, row counts before and after, verify result) into the GitHub Release body, newest first; reruns and rollbacks add rows, never replace them.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `src/lib/release-notes.ts` (status, deployments) and the `report` job of `release.yml` (research §2).

## Constraints

- FIRE_TRACKER is read only; its code may be copied.
- Prerequisite: DF-9.
