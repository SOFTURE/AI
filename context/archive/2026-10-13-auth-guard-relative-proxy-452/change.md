---
change_id: auth-guard-relative-proxy-452
title: "auth: createAuthGuard redirect \"relative\" works inside Next's proxy (issue #452)"
status: archived
roadmap_item: null
issue: 452
branch: claude/project-thread-6obp7x
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

Close [issue #452](https://github.com/SOFTURE/AI/issues/452) (labels `bug`, `pkg: auth`, `adoption`):
`createAuthGuard(config, { redirect: "relative" })` answers with a path-only `Location`. Next 16's proxy adapter parses
`Location` as an absolute URL, throws `TypeError: Invalid URL`, and the guarded page answers 500 instead of 307. The
`relative` mode must work inside Next's proxy, the documented place for the guard, and keep its promise: the browser
stays on the host and port it used.

## Context

auth is at 0.1.13 on master; `## Unreleased` already carries the `_rsc` fix (#424), which touched the same function.
Releases are batched by the coordinator: no version bump, the CHANGELOG entry goes under `## Unreleased`. The adopting
app went back to the absolute redirect with `origins.trustedOrigins` from an environment variable and can switch back
after the release.

## Constraints

- The default (`"absolute"`) redirect does not change.
- No change to the option's name or type (no breaking change).

## Notes

- Framing: skipped. The issue states the failure, the measurement and two options.

## Decisions (auto)

- Option 1 of the issue: keep the mode and build an absolute `Location` on the request URL's own origin. Next's
  adapter turns a same-host redirect back into a path-only `Location` on the wire (`getRelativeURL`), so the browser
  sees exactly what the mode promised; outside Next the `Location` is absolute on the origin the request reached.
- Option 2 (drop the mode) rejected: it breaks apps for a fix that costs one line.
- The contract test runs the guard's response through Next's real proxy adapter (`next/dist/server/web/adapter.js`),
  as the issue suggests, since `next` is already a dev dependency of the module.
