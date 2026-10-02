---
change_id: ops-health-migrate
title: "Health and migrate step"
status: backlog
roadmap_item: ID-7
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/ops`, consisting of:
- `GET /health` aggregating a DB check and checks contributed by enabled modules (200 / 503);
- a documented container recipe that runs `softure migrate` as a one-off step before the app starts
  (bundled script, least-privilege app role);
- the safe ops script pattern (dry run by default, `--commit` applies, one transaction, SQL guard test),
  as a helper plus docs;
- unit tests and an e2e health check.

## Context

From [`roadmap-identity.md`](../../../foundation/roadmaps/roadmap-identity.md), item **ID-7** (queued roadmap `identity`):

> ### ID-7: Health and migrate step
> - **Change ID:** `ops-health-migrate`
> - **Status:** ready
> - **Outcome:** `@softure-ai/ops`, consisting of:
>   - `GET /health` aggregating a DB check and checks contributed by enabled modules (200 / 503);
>   - a documented container recipe that runs `softure migrate` as a one-off step before the app starts
>     (bundled script, least-privilege app role);
>   - the safe ops script pattern (dry run by default, `--commit` applies, one transaction, SQL guard test),
>     as a helper plus docs;
>   - unit tests and an e2e health check.
> - **Prerequisites:** ID-1.
> - **Unknowns:** whether `.env.prod` rendering and release notes belong here or stay app-specific;
>   how module checks are registered (manifest vs. runtime registry from core).
> - **Risk:** low.
> - **Baseline:** source health route and container setup in FIRE_TRACKER. After: the same
>   behaviour from the module, verified in the example app's container run.
> - **PRD refs:** FR-15.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: `modules/ops/`, `examples/next-app/e2e/ops.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
