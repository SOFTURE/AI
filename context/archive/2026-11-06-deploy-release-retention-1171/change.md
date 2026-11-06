---
change_id: deploy-release-retention-1171
title: "deploy: configurable release retention and an on-demand server cleanup (issue #1171)"
status: archived
roadmap_item: null
issue: 1171
branch: claude/project-thread-8aha9h
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1171](https://github.com/SOFTURE/AI/issues/1171): a small shared host fills its disk with the images
`deploy.sh` keeps (five versions per app, hard-coded), old `softure-deploy-tools` images nobody removes, and build
cache. Make the retention a `deploy.json` setting, give operators an on-demand cleanup through the forced command
(dry run by default), and let the daily `maintain` apply the same retention and tools-image cleanup.

## Context

Labels: none (filed from an adopting app's measurements). `@softure-ai/deploy` 0.5.1. The release ships as 0.6.0
(a new setting and a new server command).

## Scope

- `releases.keep` in `deploy.json` (schema, default 5, at least 2), written by `init`, read by `server-settings`.
- `deploy.sh cleanup [--keep=N] [--commit]`: dry run by default; release folders beyond the newest N, this app's
  (and its worker's) image tags without a kept folder, other `softure-deploy-tools` tags, dangling images and build
  cache older than 24 h; never the current tag, the rollback target (`.env.prod.prev`) or an image a container uses;
  never another repository's image; disk usage before and after in `step` lines.
- `maintain` applies the same retention, tools-image, dangling and build-cache cleanup.
- `softure-deploy cleanup --host=… [--keep=N] [--commit]` sends it from an operator's machine.
- README, CHANGELOG, schema test, script tests.

## Constraints

- Owns `tools/deploy` only (plus the regenerated `tools/deploy/e2e/app`).
- Shell stays within bash 3.2 and BSD/GNU-common flags. No test talks to an external service.

## Notes

- Framing: skipped. The issue states the problem, the measurements and the requested behaviour.

## Done

`deploy.json` takes `releases.keep` (default 5, 2 to 50; `init` writes it, `server-settings` reads it); a release
prunes its folders with it after the settings step, never the previous tag's. `deploy.sh cleanup [--keep=<n>]
[--commit]` (dry run by default) removes release folders and this app's image tags beyond the newest N, other
`softure-deploy-tools` tags, dangling images and build cache older than 24 h, keeps the live tag, the rollback target
and images a container uses, lists only its own repositories, and reports `df` and `docker system df` before and
after; `maintain` runs the same steps with commit; `softure-deploy cleanup --host=…` sends it. Tests in
`tools/deploy/tests/server-files.test.ts`, `tests/schema.test.ts`, `tests/remote-cli.test.ts`,
`src/cli/server-settings-command.test.ts`; README "Server cleanup", CHANGELOG 0.6.0. Released as deploy 0.6.0.
