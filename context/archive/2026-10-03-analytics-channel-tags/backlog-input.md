---
change_id: analytics-channel-tags
title: "Channel tags"
status: backlog
roadmap_item: MO-4
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

A configurable channel parameter (name, pattern, length) read on entry, carried through redirects and the referer, exposed to the app and to auth's `onRegistered` hook for attribution; a composable middleware piece for `proxy.ts` that does not mix with the auth route guard.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MO-4** (roadmap `monetization`, main since 2026-10-03):

> ### MO-4: Channel tags
> - **Change ID:** `analytics-channel-tags`
> - **Status:** ready
> - **Outcome:** A configurable channel parameter (name, pattern, length) read on entry, carried through redirects and the referer, exposed to the app and to auth's `onRegistered` hook for attribution; a composable middleware piece for `proxy.ts` that does not mix with the auth route guard.
> - **Prerequisites:** roadmap-engagement done.
> - **Unknowns:** Where attribution is stored without a cookie (first-party query propagation only?); interaction with the auth guard ordering in `proxy.ts`.
> - **Risk:** low.
> - **Baseline:** FIRE mixes channel redirects into its auth proxy. After: unit tests on parsing and propagation, e2e that a tagged visit reaches sign-up with its channel.
> - **PRD refs:** FR-23.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/analytics/` (package scaffold, channel tagging, middleware piece), the example app `proxy.ts`, `examples/next-app/e2e/analytics-channel.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
