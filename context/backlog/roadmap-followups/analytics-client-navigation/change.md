---
change_id: analytics-client-navigation
title: "Channel tag on client navigations without Next-Url"
status: backlog
roadmap_item: FU-5
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

Keep the channel tag on every Next.js client navigation without relying on the router's `Next-Url` header.

## Context

From [`roadmap-followups.md`](../../../foundation/roadmaps/roadmap-followups.md), item **FU-5** (queued roadmap `followups`):

> ### FU-5: Channel tag on client navigations without Next-Url
> - **Change ID:** `analytics-client-navigation`
> - **Status:** proposed
> - **Outcome:** Every Next.js client navigation from a tagged page keeps the channel tag, without relying on the router's `Next-Url` header (for example a client component of `/next` that re-applies the tag after router navigations, or a link component that adds it).
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether Next exposes a stable signal for router requests in the proxy; a client component vs. a link wrapper.
> - **Risk:** LOW.
> - **Baseline:** monetization MO-4 `analytics-channel-tags`: Next strips its `RSC` header before the proxy runs, so the proxy piece recognises a client navigation by the `Next-Url` header the router sends; a navigation without it is not re-tagged (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-23.
> - **Source:** `modules/analytics/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/analytics/` channel propagation.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
