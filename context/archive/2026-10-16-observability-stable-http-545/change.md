---
change_id: observability-stable-http-545
title: "observability: mirror legacy HTTP server attributes onto their stable names (issue #545)"
status: archived
roadmap_item: null
issue: 545
branch: claude/project-thread-qxjrkd
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #545](https://github.com/SOFTURE/AI/issues/545): the root spans Next.js creates for incoming requests
carry only the legacy `http.status_code`, `http.method` and `http.target`, so queries written against the stable
conventions (`http.response.status_code`) match nothing.

## Context

observability 0.1.3 is the latest on npm and on master. #546 and #547 change the same package in the same pull
request. Releases are batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- The legacy keys stay on the span, so existing queries keep working.
- A stable key the span already has is never overwritten.
- `url.path` never carries the query string.

## Notes

- Framing: skipped. The issue names the cause, the place and the fix.

## Decisions (auto)

- A span processor with `onEnding` (sdk-trace 2.x, the span is still writable there), for `SpanKind.SERVER` spans
  only, as the issue describes.
- Behind `traces.stableHttpAttributes` on `ObservabilityOptions`: off by default in `startObservability` (a plain
  Node.js process has no legacy server spans of its own), on by default in `registerObservability` (`/next`), the
  same pattern as `instrumentations.fetch`.
