---
change_id: auth-guard-rsc-424
title: "auth: createAuthGuard drops Next's _rsc parameter from next= (issue #424)"
status: open
roadmap_item: null
issue: 424
branch: claude/project-thread-jmzazu
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #424](https://github.com/SOFTURE/AI/issues/424) (labels `bug`, `pkg: auth`): `createAuthGuard` builds
`next=` from `url.pathname + url.search`, so a signed-out client navigation that carries Next's `_rsc` cache key sends
the visitor back to `/page?_rsc=…` after sign-in. The guard drops `_rsc` from `next=` and keeps every other query
parameter as the request wrote it.

## Context

auth is at 0.1.13 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. An adopting app strips `_rsc` itself before calling the guard; it can drop that after the release.

## Constraints

- Only `next=` changes; which paths are guarded and where the redirect goes stay as they are.
- Other parameters keep their exact spelling (encoding, order, empty values): no round trip through `URLSearchParams`.

## Process notes

- Framing: skipped. The issue states the cause, the reproduction and the expected `Location`.

## Decisions (auto)

- No version bump; `## Unreleased` in the auth CHANGELOG (batched releases).
- Only `_rsc` is dropped, matched by its decoded name (so `%5Frsc` too) and case-sensitively, like Next.
