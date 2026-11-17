---
change_id: example-minimatch-1319
title: "security: lift minimatch to ^11.0.4 in the example app (issue #1319, Dependabot alert #42)"
status: archived
archived_at: 2026-11-17
roadmap_item: null
issue: 1319
branch: claude/project-thread-899qdw
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Dependabot alert #42 (GHSA-g3hv-75wg-m249, minimatch globparts amplification, fixed in 11.0.1) is fixed in
`examples/next-app/package-lock.json`, and issue #1319, which the alert sync opened for it, closes itself.

## Context

- The example app resolves `minimatch` 10.2.6 (dev) through `glob` 13.0.7, which declares `minimatch ^10.2.2`.
  No 10.x release carries the fix.
- The root manifest already overrides `minimatch` to `^11.0.4` for the same reason; the example app has its own
  lockfile and no override.

## Scope

- `examples/next-app/package.json`: `overrides.minimatch: "^11.0.4"`, matching the root.
- `examples/next-app/package-lock.json`: regenerated; `minimatch` 11.x.

## Constraints

- No other version moves in the example lockfile beyond what the override pulls in.
- The example still installs, lints, builds and passes its e2e (CI `e2e.yml`).

## Notes

- Research: kept short in `research.md`; framing skipped, the alert names the outcome.
- No release: the example app is private and unpublished.

## Done

- `examples/next-app`: `minimatch` overridden to `^11.0.4` (lockfile 11.0.9), fixing Dependabot alert #42.
