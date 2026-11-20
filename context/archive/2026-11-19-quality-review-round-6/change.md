---
change_id: quality-review-round-6
title: "jobs, deploy: close the suggestions of the sixth 2026-11-19 quality review round"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the suggestions of the sixth review round at 1b894f4 (no critical or warning left): jobs QR-607519c5 and deploy
QR-69cd3d28, QR-be4be4fa, QR-ef7ac63e, QR-00052875, QR-5c32c75f and QR-e46c0b94.

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean.

## Scope

- jobs `src/workers/scheduled.ts`: `runTick` takes one options object.
- deploy `src/init/answers.ts`, `src/init/generate.ts`, `src/verify/checks.ts`, `src/verify/run-checks.ts`,
  `src/verify/schema.ts`: drop `export` from 25 names no other file, test or index imports.

## Notes

- Frame and research skipped: mechanical changes; each name was checked with a repository-wide search first.

## Decisions (auto)

- None of the 25 names is reachable from a package entry (`src/index.ts` re-exports only the folder indexes, which
  name none of them), so dropping `export` changes no public API and needs no changelog entry.

## Done

- On master with the next releases: jobs and deploy (with `quality-review-security-jobs-deploy`).
