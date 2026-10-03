---
change_id: analytics-channel-tags
title: "Channel tags"
status: implementing
roadmap_item: MO-4
branch: claude/mo-4-analytics-channel-tags-q9v7rh
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`@softure-ai/analytics` reads an acquisition channel tag from the URL (`?z=newsletter`) without a
cookie: the parameter name, its pattern and its length come from `analytics({ channel })`. A proxy
piece for the app's `proxy.ts` carries the tag on to the next first-party page through the Referer
(a navigation without the tag, coming from a tagged page, is redirected to the same URL with it) and
through redirects other pieces answer with (the auth guard's redirect to login keeps it). The app
reads the tag with `getChannel()` in actions and hooks (from the Referer) and with
`getChannelFromSearchParams()` in pages; `attributeRegistration()` hands it to auth's
`onRegistered` hook. Nothing is stored by the module: MO-5 adds the only table.

## Context

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MO-4).

## Constraints

- Exclusively owns: `modules/analytics/` (package scaffold, channel tagging, proxy piece), the example
  app's `proxy.ts`, `examples/next-app/e2e/analytics-channel.spec.ts`.
- The proxy piece uses Web `Request`/`Response` only, like auth's guard, and never reads or writes a cookie.
- No migration (MO-5 owns the analytics migration).
