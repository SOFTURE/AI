---
change_id: next-actions-spike
title: "Modules ship server actions, route handlers and pages from their package"
status: plan_reviewed
roadmap_item: ID-1
branch: claude/id-1-next-actions-spike-4b8sg6
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Settle, with a reproducible spike, whether a module package can ship a `"use server"` action, a
route handler and a server component page to a Next 16 app from `node_modules`, in `next dev` and
in `next build && next start`, installed as a packed copy and linked from the workspace. Record the
verdict and the rules in docs/02 §8, confirm or replace the config registry of `@softure-ai/core/next`,
and leave an e2e check in the example app.

Also give module authors a migrations-folder form that builds under Turbopack
(`context/backlog/next-integration.md`): the documented `new URL("../migrations/", import.meta.url)`
fails `next build`.

## Context

Taken from the backlog entry, see [`backlog-input.md`](backlog-input.md) (roadmap `identity`, item
**ID-1**, promoted on 2026-10-02). The owner (Jaro) ordered the identity roadmap to start while
FD-8 waits; the coordinator added the Turbopack migrations finding to this item.

## Constraints

- Exclusively owns: `spikes/next-actions/`, `docs/02-module-standard.md` §8, its e2e file
  `examples/next-app/e2e/next-actions.spec.ts` and the mount files under `examples/next-app/app/spike/`
  and `app/api/spike/`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry.
- `foundation/core`: one additive export (`resolveMigrationsDir`) and docs; no contract break.
- English-only code, comments and commits. User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish.

## Notes
