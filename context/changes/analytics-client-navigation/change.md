---
change_id: analytics-client-navigation
title: "Channel tag on client navigations without Next-Url"
status: impl_reviewed
roadmap_item: FU-5
branch: claude/project-thread-y037s0
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A visitor who arrived with a channel tag (`?z=ads`) and moves through the app with Next.js client navigations
(`next/link`, `router.push`, a prefetched route served from the router's cache) keeps the tag in the address bar on
every page, whether or not the router sent its `Next-Url` header and whether or not the navigation reached the proxy
at all. Beacons, server actions and the next full page load from such a page then see the channel. Unit tests and an
e2e test that removes `Next-Url` from the router's requests prove it.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-5** (roadmap `followups`, main since 2026-10-03):

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

Current state: `createChannelTagger().tag` (`modules/analytics/src/proxy/index.ts`) answers a router request carrying
`Next-Url` with a 307 to the tagged URL; `examples/next-app/e2e/analytics-channel.spec.ts` covers a `next/link` click
that sends it. The backlog entry this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: `modules/analytics/` channel propagation (lane D). FU-7 (server action redirects) follows this
  change on `master` and is not done here.
- Shared with parallel threads: `examples/next-app/` (layout, e2e) is also touched by FU-1, FU-2 and FU-11; master
  wins, conflicts are resolved here.
- No new cookie or storage: the tag stays in first-party URLs only (the module's GDPR stance, README §11).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `followups`, item FU-5 (taken from `context/backlog/roadmap-followups/`).
- Research done (quick depth): the first roadmap Unknown needs a read of Next 16's proxy adapter and router.
- Framing skipped: the gap is documented and confirmed (README §12, research), the outcome and its proof are pinned by
  the roadmap item, and nothing questions whether this is the right problem; the solution choice the roadmap leaves
  open (client component or link wrapper) is a plan decision.
