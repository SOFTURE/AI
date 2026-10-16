---
change_id: observability-ignore-paths-546
title: "observability: drop server traces for chosen paths such as a health check (issue #546)"
status: archived
roadmap_item: null
issue: 546
branch: claude/project-thread-qxjrkd
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #546](https://github.com/SOFTURE/AI/issues/546): a container health check every 15 s makes about 5,760
traces a day that bury real requests, and `startObservability` offers no way to leave a route out.

## Context

Same package and pull request as #545 and #547. No version bump; CHANGELOG `## Unreleased`.

## Constraints

- Without the option nothing changes: every span is recorded, as with today's default sampler.
- Child spans of a dropped request are dropped with it.
- A query string does not defeat the match.

## Notes

- Framing: skipped. The issue names the option and the mechanism.

## Decisions (auto)

- `traces.ignorePaths` on `ObservabilityOptions`: a sampler that returns `NOT_RECORD` for a `SpanKind.SERVER`
  span whose `url.path` or `http.target` (query dropped) matches, and delegates to `ParentBased(AlwaysOn)` (the
  SDK default) otherwise.
- An entry matches its exact path and everything below it as whole segments: `/api/health` matches
  `/api/health` and `/api/health/live`, not `/api/healthz`. An entry must start with `/`; anything else is a
  start-up error naming the option.
- No default in the Next.js adapter: the issue says an explicit option is enough, and a default path would hide an
  app's own route.
