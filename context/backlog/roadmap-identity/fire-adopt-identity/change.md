---
change_id: fire-adopt-identity
title: "FIRE_TRACKER adopts the identity modules"
status: backlog
roadmap_item: ID-9
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

following docs/05:
- FIRE_TRACKER configures security, auth (with roles and reset), feature-switches and ops through
  `softure.config.ts`, with its Polish routes and copy passed as messages and routes;
- an adoption migration moves `users`, `sessions`, `auth_attempts` and `feature_switches` into
  the module schemas without data loss, and billing/analytics columns move to app-owned 1:1 tables;
- `softure migrate --adopt` marks the module migrations;
- FIRE deletes its own implementation (the source files listed in docs/01 for these modules);
- FIRE's full integration suite is green, and the migration dry run on a production copy passes.

FIRE_TRACKER currently guards admin surfaces with an interim email allowlist (`ADMIN_EMAILS`,
from the change `switches-admin-guard`). This item replaces it with roles from ID-4 and the
switches panel from ID-6, and moves the configured admins into `auth.user_roles`.

## Context

From [`roadmap-identity.md`](../../../foundation/roadmaps/roadmap-identity.md), item **ID-9** (queued roadmap `identity`):

> ### ID-9: FIRE_TRACKER adopts the identity modules
> - **Change ID:** `fire-adopt-identity`
> - **Status:** ready
> - **Outcome:** following docs/05:
>   - FIRE_TRACKER configures security, auth (with roles and reset), feature-switches and ops through
>     `softure.config.ts`, with its Polish routes and copy passed as messages and routes;
>   - an adoption migration moves `users`, `sessions`, `auth_attempts` and `feature_switches` into
>     the module schemas without data loss, and billing/analytics columns move to app-owned 1:1 tables;
>   - `softure migrate --adopt` marks the module migrations;
>   - FIRE deletes its own implementation (the source files listed in docs/01 for these modules);
>   - FIRE's full integration suite is green, and the migration dry run on a production copy passes.
>
>   FIRE_TRACKER currently guards admin surfaces with an interim email allowlist (`ADMIN_EMAILS`,
>   from the change `switches-admin-guard`). This item replaces it with roles from ID-4 and the
>   switches panel from ID-6, and moves the configured admins into `auth.user_roles`.
> - **Prerequisites:** ID-8.
> - **Unknowns:** how FIRE's billing and channel columns on `users` are split out before or during
>   the move; whether the apex/subdomain cookie setup needs module options; which FIRE integration
>   tests need selector updates.
> - **Risk:** high. Live production data.
> - **Baseline:** FIRE's own implementation and its integration suite. After: same suite green on
>   the modules, own code deleted, CHANGELOG notes "verified in: FIRE_TRACKER@<sha>" for each
>   module version.
> - **PRD refs:** FR-26, G-2.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: nothing in this repository; the work happens in the FIRE_TRACKER repository (gaps found there become issues in SOFTURE/AI).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
