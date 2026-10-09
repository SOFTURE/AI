---
change_id: deploy-release-0-1-7
title: "deploy: version 0.1.7 carries the Unreleased fixes for #296 and #297 (issue #307)"
status: archived
roadmap_item: null
issue: 307
branch: claude/project-thread-6zzv73
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

`@softure-ai/deploy` moves to 0.1.7 so that `auto-release.yml` tags `deploy@0.1.7` and publishes it: the
`## Unreleased` section of `tools/deploy/CHANGELOG.md` (#296 `secrets-from-environment`, #297 `init` reading the
compose file and `--workflows-ref`) becomes `## 0.1.7`, and the reusable deploy workflows default
`deploy-cli-version` to 0.1.7, so the tag's commit is the one callers pin with `--workflows-ref`.

## Context

Issue [#307](https://github.com/SOFTURE/AI/issues/307): npm still has 0.1.6, so an adopting app cannot use the
fixes merged for #296 and #297. The precedent for a deploy version bump is #292 (`package.json`, the lockfile, the
CHANGELOG heading and the `deploy-cli-version` default of `deploy-app.yml`, `deploy-integration.yml` and
`deploy-report.yml`, pinned equal by `tests/repo/deploy-workflows.test.ts`).

## Constraints

- No code change: version, lockfile, CHANGELOG heading, workflow defaults and the README's `git ls-remote` example.
- The tag and the publish come from `auto-release.yml` after the merge (cloud sessions cannot push tags).
- English only.

## Notes

- Research: skipped; the issue names the version and the precedent (#292) shows every file a deploy bump touches.
- Framing: skipped; the ask is a release of merged work.
- Archived 2026-10-09: version 0.1.7 everywhere the package version is pinned; release follows the merge.
