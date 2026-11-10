---
change_id: observability-memory-metrics
title: "observability: process and container memory gauges"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/observability-memory-metrics
created: 2026-11-10
updated: 2026-11-10
---

## Intent

An adopting app runs a memory-limited worker (ffmpeg and Chromium children) in a container on a shared server. Its
cgroup came close to the limit (1.22 of 1.5 GiB, swap in use), yet Grafana showed only the V8 heap: nothing about the
process's resident set or the container's memory. The app needs those series to chart them and alert near the limit,
and the need is generic to every app that exports metrics from a container.

## Context

`startObservability` registers the OpenTelemetry runtime instrumentation (`nodejs.eventloop.*`, `v8js.*`), which has no
RSS and no cgroup reading. The owner's rule for adopting apps: a common need is fixed in the package, released and
bumped, never worked around locally.

## Constraints

- On by default with metric export, off with `instrumentations.memory: false`; nothing changes without an endpoint.
- No new dependency; at most five series per process.
- cgroup v2 only (Docker and Kubernetes on current kernels); elsewhere only the process gauge.

## Notes

- Research: skipped. One module next to `start.ts`; the cgroup v2 files are the kernel's documented interface
  (`memory.current`, `memory.max`, `memory.stat`, `memory.swap.current`).
- Framing: skipped. The gap and the fix are named by the adopting app's measured incident.

## Done

`@softure-ai/observability` 0.8.3: `process.memory.usage` and, in a cgroup v2 container, `container.memory.usage`,
`container.memory.working_set`, `container.memory.limit`, `container.memory.swap.usage`; `instrumentations.memory`;
`MEMORY_METRIC_NAMES` from `/node`. README and CHANGELOG updated.
