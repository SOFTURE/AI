---
change_id: packages-first-release
title: "Every package is publishable at 0.1.0, so the owner's first release is tags only"
status: implementing
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

The owner can release every SOFTURE AI package for the first time by pushing tags, with nothing to edit
by hand: `@softure-ai/core`, `db` and `ui` are no longer private, every workspace package (except the
template) is at version 0.1.0 in `package.json`, `module.json` and its inline manifest, every internal
`@softure-ai/*` range and `dependsOn` range accepts 0.1.0, and the release runbook lists the tags in
dependency order, at most three per push. A package installed from npm then resolves its
`@softure-ai/*` dependencies from npm too.

## Context

The owner asked (2026-10-05, in the project thread) what to do to get the releases going,
added `NPM_TOKEN` and `STRIPE_SECRET_KEY` to the repository secrets and gave the go-ahead for this
preparation step.

Found while answering:

- `foundation/core/package.json:4`, `foundation/db/package.json:4` and `foundation/ui/package.json:4` have
  `"private": true`, while every module depends on core and db (most on ui). Releasing BL-8, MK-8, EN-9 and
  MO-6 alone would publish packages whose dependencies are not on npm.
- auth, ops, security and feature-switches belong to no release item, but billing, privacy, waitlist,
  mcp-access, blog and analytics depend on them.
- Every package is at `0.0.0` with `^0.0.0` ranges, which accept only 0.0.0. `npm run release:version`
  refuses a bump that a dependent's range rejects, so the first release would need a range commit
  before each bump.
- `npm view` finds none of the packages on npm (only `@softure-ai/skills`, so the scope exists).

The items it unblocks stay in the queued roadmap [`later`](../../foundation/roadmaps/roadmap-later.md)
(BL-8, MK-8, EN-9, MO-6): they close once the owner's tags are live.

## Constraints

- Owns: the `version`, `private` and internal range fields of every workspace `package.json`, every
  `module.json`, the inline manifests in `modules/*/src/index.ts`, the tests that quote a range in an
  error message, both lockfiles, the README status lines that say "not published yet",
  `scripts/release/README.md`.
- Must not tag, publish or create a GitHub Release (`release.owner` in `context/workflow.json`).
- Must not touch LT-1 (`billing-stripe-sandbox-e2e`), which another thread runs.
- The template (`templates/package/`) stays private at 0.0.0: it is copied, never released.
- English-only code, comments and commits (AGENTS.md). Gaps found on the way go to the queued roadmap
  `later` as `LT-` items, not fixed here.

## Notes

- Placement: no main roadmap is in flight; the owner asked for this step directly, as the preparation
  of the `later` release items. No roadmap item of its own.
- Research: short (where versions and ranges live). Framing skipped: the problem is a set of concrete
  manifest fields found above, not in doubt.
