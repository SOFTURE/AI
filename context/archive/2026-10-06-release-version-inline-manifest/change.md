---
change_id: release-version-inline-manifest
title: "release:version keeps a module's inline manifest in step with module.json"
status: archived
roadmap_item: LT-2
branch: claude/lt-2-fpsu3y
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`npm run release:version -- <module> <bump>` leaves the module's tests green: the version it writes to
`package.json` and `module.json` also lands in the inline manifest of `src/index.ts`, so the gates the release
workflow runs on the tag pass. A reviewer checks `tests/repo/release-version.test.ts` (every released module's
`src/index.ts` is updated in exactly one place) and a dry bump of `ops` in a scratch worktree whose module tests stay
green.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item LT-2, taken 2026-10-06).

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **LT-2**:

> - **Outcome:** `release:version` updates (or makes redundant) the inline manifest version of a module, so the
>   bumped module's "ships a module.json equal to its manifest" test and the release gates stay green.
> - **Unknowns:** whether the inline manifest should import `module.json` instead of repeating it.
> - **Baseline:** `scripts/release/version.mjs` writes `package.json`, the lockfile and `module.json` only; each
>   module repeats `version` in `src/index.ts`, and its `tests/module.test.ts` compares the two.

The owner asked to clear the whole backlog by the morning of 2026-10-07, LT-2 and LT-3 before the charts roadmap
(coordinator brief, 2026-10-06).

## Constraints

- Owns: `scripts/release/version.mjs`, `scripts/release/README.md`, `tests/repo/release-version.test.ts`, the LT-2
  rows of `roadmap-later.md` and its backlog README.
- No package version changes and no release: the script only learns a third file.
- English-only code, comments and commits (AGENTS.md).

## Process notes

- Research: short ([`research.md`](research.md)); the question is one script and twelve module entry points.
- Framing: skipped. The problem is a measured gap with one stated cause (the script does not know the third copy
  of the version) and the roadmap already names the two candidate answers; research settles between them.
