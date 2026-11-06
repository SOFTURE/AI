---
change_id: ci-cache-poisoning-1112
title: "deploy-release-checks: close the CodeQL cache poisoning alerts (issues #1112, #1113, #1114, #1115)"
status: impl_reviewed
roadmap_item: null
issue: [1112, 1113, 1114, 1115]
branch: claude/project-thread-cfjyr1
created: 2026-11-06
updated: 2026-11-06
---

## Intent

Close the four code-scanning alerts #52 to #55 (rule `actions/cache-poisoning/poisonable-step`, CodeQL) that point at
the `Install`, `Type check and lint` and `Unit tests` steps of `.github/workflows/deploy-release-checks.yml`, reported
as issues #1112 to #1115.

## Context

The `static` and `unit` jobs check out `needs.prepare.outputs.ref` and then run the caller's commands. The caller in
this repository (`e2e-deploy.yml`) runs on `workflow_dispatch` and `push` to master, events that write to the default
branch's cache scope.

## Constraints

- No behaviour change for callers: the same commit is checked out, the reusable workflow's inputs and outputs stay.
- No package changes, so no release.

## Notes

- Framing: skipped. The alerts name the rule and the lines.
