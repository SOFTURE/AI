---
change_id: ui-query-nav-active-454
title: "ui: QuerySegmentedNav renders outside a Next request and takes the active view from the server (issue #454)"
status: archived
roadmap_item: null
issue: 454
branch: claude/project-thread-bs6ls3
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

Close [issue #454](https://github.com/SOFTURE/AI/issues/454) (labels `enhancement`, `pkg: ui`):
`QuerySegmentedNav` from `@softure-ai/ui/next` must render when `useSearchParams()` or `usePathname()` returns
`null` (static rendering in a unit test, the Pages Router), treating them as an empty query and no pathname, and it
must take an optional `active` prop that wins over the URL, so the view the server parsed decides the current item.

## Context

ui is at 0.2.0 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Open PRs that also touch ui (#447, #451) merge first; this change rebases onto them by merging master.

## Constraints

- Links keep the other parameters, never scroll, and the default view's link drops the parameter, as today.
- No change to `SegmentedNav` or `getQueryHref`.

## Notes

- Framing: skipped. The issue names the two problems and the exact asks.

## Decisions (auto)

- `active` wins whenever it is given, also when the URL names another item; without it the URL decides, as before.
- With no pathname (`usePathname()` is `null`) the links are query-only (`?view=chart`), and the default view's link
  is `?`, so they still resolve against the current page instead of an empty `href` that would keep the parameter.
