---
change_id: identity-release
title: "Identity release"
status: backlog
roadmap_item: ID-8
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/security`, `@softure-ai/auth`, `@softure-ai/feature-switches` and
`@softure-ai/ops` 0.1.0 published through the FD-2 pipeline. The owner approves each first
(staged) publish on npmjs.com and adds a trusted publisher for each package. README status lines
are updated, and a finish review runs across ID-1…ID-7.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **ID-8** (roadmap `identity`):

> ### ID-8: Identity release
> - **Change ID:** `identity-release`
> - **Status:** ready
> - **Outcome:** `@softure-ai/security`, `@softure-ai/auth`, `@softure-ai/feature-switches` and
>   `@softure-ai/ops` 0.1.0 published through the FD-2 pipeline. The owner approves each first
>   (staged) publish on npmjs.com and adds a trusted publisher for each package. README status lines
>   are updated, and a finish review runs across ID-1…ID-7.
> - **Prerequisites:** ID-2, ID-3, ID-4, ID-5, ID-6, ID-7.
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, G-4.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: package versions and README status lines of security, auth, feature-switches, ops.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
