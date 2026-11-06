---
change_id: held-deps
title: "deps: land the held satori, typescript-eslint and forwarded-parse upgrades"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-x73g9i
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

The last two Dependabot rounds held three upgrades: satori 0.63 (OG render tests fail), typescript-eslint 8.72 (the
typed lint runs out of memory at CI's 8 GB heap) and forwarded-parse 2.2.0 (`instrumentation-http` pins 2.1.2). The
owner wants them fixed and released, not ignored, and the residual moderate `fflate` finding that marketing-kit's
consumers get through satori cleared where it can be. Anything that truly cannot land gets a narrow Dependabot ignore
with its reason.

## Notes

- Research recorded in research.md; no frame needed (the problem is measured, not in doubt).

## Done

- typescript-eslint ^8.72.1; `disallowAutomaticSingleRunInference` in the root ESLint config keeps the 8.71 memory
  profile (peak RSS 5.95 GB vs. an out-of-memory abort at 8 GB with single-run inference on).
- OpenTelemetry 3.1 / 0.301 in `@softure-ai/observability` (and `sdk-trace` 3.1 in `@softure-ai/llm`):
  `instrumentation-http` 0.301 pins forwarded-parse 2.2.0 and imports it statically, so observability drops its own
  `forwarded-parse` dependency and `require`; a standalone build of the example app still ships it and starts with
  export on.
- satori 0.63.2 in `@softure-ai/marketing-kit`: every OG element defaults to `boxSizing: "border-box"`; snapshots
  re-recorded with the same layout.
- fflate: satori 0.63.2 still pins 0.7.3; the advisory's `unzipSync` is never reached (satori imports only
  `inflateSync`). The README tells a project how to lift it with `overrides`. No Dependabot ignore is needed.
- marketing-kit, observability and llm carry `## Unreleased` entries for the next combined release.
