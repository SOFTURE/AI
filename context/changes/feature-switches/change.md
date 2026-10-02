---
change_id: feature-switches
title: "Feature switches module: declared switches with env overrides and a fail mode, isEnabled and setSwitch, and an admin-only panel"
status: implementing
roadmap_item: ID-6
branch: claude/id-6-feature-switches-3xypko
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

An app that lists `featureSwitches({ switches: [...] })` in `softure.config.ts` can turn features on
and off at runtime without a deploy. Each switch is declared once (name, label, description,
default, fail mode); its value is the environment override when one is set, else the stored row in
`features.switches`, else the declared default, and the fail mode when the stored state cannot be
read. Server code asks `isEnabled(name)`; an admin flips switches in a generic panel that lists
every declared switch and is closed (not found) to everyone without the panel role from
`@softure-ai/auth`. The module cannot be enabled without auth, so the panel never mounts without an
authorization check.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `identity`), item **ID-6**. Outcome, unknowns,
risk and baseline are quoted there.

What ID-4 left for this change (coordinator brief, 2026-10-02): guard pages with
`requireRole(ADMIN_ROLE)` from `@softure-ai/auth/next` (404 for anonymous and non-admin visitors),
call `authorizeRole(ADMIN_ROLE)` in actions before reading the form, `hasRole` only for UI. The
example's `/admin` belongs to ID-4, so the panel mounts under its own path. e2e uses its own
account and grants admin with `npm run grant-role -- --email=… --role=admin --commit`.

## Constraints

- Exclusively owns: `modules/feature-switches/`, `examples/next-app/e2e/feature-switches.spec.ts`,
  the example's switches page and its banner switch.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry.
- `modules/auth/` is not touched: ID-5 changes it in parallel.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes

- 2026-10-02: taken in the cloud session on `claude/id-6-feature-switches-3xypko`.
