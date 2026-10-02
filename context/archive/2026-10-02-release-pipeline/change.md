---
change_id: release-pipeline
title: "Tag-driven release pipeline"
status: archived
roadmap_item: FD-2
branch: claude/fd-2-release-pipeline-y0qm8t
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02
---

## Intent

a `<package>@x.y.z` tag (e.g. `core@0.1.0`) validates the package, publishes
`@softure-ai/<package>` to npm through trusted publishing with provenance, publishes
`@softure/<package>` to GitHub Packages and creates a GitHub Release with the tarball, the same
way as SOFTURE/SKILLS (`release.yml` there is the reference).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-2** (roadmap `foundation`):

> ### FD-2: Tag-driven release pipeline
> - **Change ID:** `release-pipeline`
> - **Status:** ready
> - **Outcome:** a `<package>@x.y.z` tag (e.g. `core@0.1.0`) validates the package, publishes
>   `@softure-ai/<package>` to npm through trusted publishing with provenance, publishes
>   `@softure/<package>` to GitHub Packages and creates a GitHub Release with the tarball, the same
>   way as SOFTURE/SKILLS (`release.yml` there is the reference).
> - **Prerequisites:** FD-1.
> - **Unknowns:** one workflow file for all packages vs. one per package (npm binds the trusted
>   publisher to a workflow file name per package); changesets vs. plain `npm version -w`; how a
>   brand-new package does its first publish (staged approval by the owner).
> - **Risk:** medium. Publishing mistakes are public and versions cannot be reused.
> - **Baseline:** no release path. After: a `workflow_dispatch` dry run (pack, validate, no publish)
>   passes in CI. The first real tag is the owner's (FD-8); expect this item to end as
>   `done_code (…; waiting: first tagged release)`.
> - **PRD refs:** FR-2, G-4.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `.github/workflows/release.yml`, `scripts/release/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

Archived 2026-10-02: a `<package>@x.y.z` tag stages the package on npm (OIDC, provenance), publishes it to GitHub Packages and creates a GitHub Release; the dry run is green in CI. The first real tag is the owner's (FD-8).
