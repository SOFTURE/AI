---
change_id: blog-check-without-database
title: "softure-blog check without a database URL"
status: planned
roadmap_item: BF-6
branch: claude/project-thread-aimblk
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-blog check` runs in CI with an app config whose database URL is missing or empty, since the
gate never connects to the database. The reusable workflow `.github/workflows/blog-links.yml` no longer
passes a placeholder `DATABASE_URL`. A reviewer checks that the bin's `check` loads a fixture config whose
`database.url` comes from an unset variable, that `publish` with the same config still refuses it, and
that the workflow has no `database-url` input or `DATABASE_URL` variable.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-6, taken 2026-10-05).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-6**:

> - **Outcome:** `softure-blog check` loads an app config that has no database URL (or a placeholder) without failing: either core lets a command opt out of the database requirement, or the blog bin builds a check-only config; the weekly workflow drops its placeholder `DATABASE_URL`.
> - **Risk:** low. The reusable workflow passes a placeholder URL today; `check` never connects.
> - **Source:** BL-6 `blog-quality-gate` impl review R2.

BF-1 (`cli-config-loader`, PR #89) is on `master`: the bins load the config through
`@softure-ai/core/cli` (`loadAppConfig`).

Coordinator brief (2026-10-05): only BF-6, lane A; gaps go to the roadmap as `BF-` items from the next
free number (BF-11 taken, BF-12 reserved for BF-2's gap).

## Constraints

- Owns: `foundation/core/src/config.ts`, a new `foundation/core/src/database-requirement.ts`,
  `foundation/core/src/cli/load-config.ts`, `modules/blog/src/cli/command.ts`,
  `.github/workflows/blog-links.yml`, their tests and READMEs.
- `softure migrate`, `softure-mail` and `softure-blog publish` keep requiring a database exactly as today.
- English-only code, comments and commits (AGENTS.md).

## Notes

- Placement: main roadmap blog-followups, item BF-6 (work now).
- Framing skipped: the problem (a CI-only command forced to carry a fake database URL) and the outcome
  are fixed by the roadmap item and the BL-6 impl review R2 that found it; the two candidate shapes are
  weighed in the research.
