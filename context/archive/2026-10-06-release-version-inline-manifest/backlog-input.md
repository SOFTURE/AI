---
change_id: release-version-inline-manifest
title: "release:version keeps a module's inline manifest in step with module.json"
status: backlog
roadmap_item: LT-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`npm run release:version -- <module> <bump>` leaves the module's tests green: the version it writes to
`package.json` and `module.json` also lands in the inline manifest of `src/index.ts` (or the manifest is
read from `module.json`), so the gates the release workflow runs on the tag pass.

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **LT-2**:

> ### LT-2: release:version keeps inline manifests in step
> - **Change ID:** `release-version-inline-manifest`
> - **Status:** ready
> - **Outcome:** `release:version` updates (or makes redundant) the inline manifest version of a module, so the bumped module's "ships a module.json equal to its manifest" test and the release gates stay green.
> - **Prerequisites:** none.
> - **Unknowns:** whether the inline manifest should import `module.json` instead of repeating it.
> - **Risk:** low.
> - **Baseline:** `scripts/release/version.mjs` writes `package.json`, the lockfile and `module.json` only; each module repeats `version` in `src/index.ts`, and its `tests/module.test.ts` compares the two. After: a bump leaves them equal.
> - **Source:** `packages-first-release` research (2026-10-05).

## Constraints

- Owns: `scripts/release/version.mjs`, `tests/repo/release-version.test.ts`, and the module manifests if
  they change shape.
- English-only code, comments and commits (AGENTS.md).

## Notes
