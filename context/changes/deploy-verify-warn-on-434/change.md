---
change_id: deploy-verify-warn-on-434
title: "deploy: verify routes whose listed statuses only warn (issue #434)"
status: archived
roadmap_item: null
issue: 434
branch: claude/project-thread-v7bw0v
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

Close [issue #434](https://github.com/SOFTURE/AI/issues/434) (labels `enhancement`, `pkg: deploy`, `adoption`): a
verify route has one expected `status` and one `severity`, so an optional resource (the Web Bot Auth key directory,
404 until a key is configured) can be checked only as a warn route, which hides real breakage, or as a fail route,
which fails every release until the key exists. A route gains `warnOn: { status: [...] }`: a response whose status is
listed is a `WARN` row and its other checks are skipped; any other mismatch keeps the route's severity.

## Context

deploy is at 0.1.11 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- Additive: a route without `warnOn` behaves exactly as today.
- The JSON schema file is regenerated with the package's own script, never by hand.

## Notes

- Framing: skipped. The issue states the problem and the proposed key.

## Decisions (auto)

- Key shape as proposed: `warnOn: { status: number[] }` (an object, so later conditions can join it).
- A listed status that equals the route's `status` is refused by the schema (it could never warn); the list must be
  non-empty and unique.
- `warnOn` also covers a `forEach` source: a listed status on the sitemap or index is one `WARN` row, not a failure.
- The issue's minor aside (a header check anchored at the start of the value) is out of scope: filed as its own issue.
- No version bump; `## Unreleased` in the CHANGELOG.
