---
change_id: ci-usage-close-issue
title: "ci-usage can close the report issue after publishing (issue #1390)"
status: archived
roadmap_item: null
issue: 1390
branch: claude/project-thread-jppon2
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19
---

## Intent

An adopting app keeps its open issue count for work only: `publish` can close the report issue as completed once
its body and the run's comment are written (CLI `--close`, workflow input `close-issue`, default `false`). The next
run finds no open issue and opens a fresh one, so each run leaves one closed issue and still notifies the owner.

## Context

- Issue #1390 (labels: `enhancement`, `pkg: ci-usage`). ci-usage 0.1.2 keeps one rolling open issue labelled
  `ci-usage`; `findIssue` looks only for an open issue carrying the report marker.
- The adopting app closes the issue today with a follow-up `gh issue close` job and drops it once this ships.

## Constraints

- Default behaviour unchanged (`close` off). The JSON schema stays `schemaVersion: 1`.
- No change in any app repository.

## Notes

- Frame skipped: the need and the proposal are concrete in the issue, and the change is one optional step.

## Done

- `@softure-ai/ci-usage` 0.2.0: `publish --close`, workflow input `close-issue` (default `false`); SOFTURE/AI's
  `ci-usage-self.yml` closes its report issues. Release: next, through the trusted publisher (`auto-release.yml`,
  `ci-usage`).
- After the release: dispatch `ci-usage-self.yml`; the run is green and its report issue ends closed as completed.
