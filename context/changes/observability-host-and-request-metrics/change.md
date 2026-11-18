---
change_id: observability-host-and-request-metrics
title: "observability: host gauges and the request metric for Next.js apps"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-d2teps
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let an app on a shared server see the server's disk, memory and CPU, and its own HTTP errors, in Grafana without a
host agent.

## Context

An adopting app's server filled its disk to 98% and a deploy failed on the image pull; nothing in Grafana showed it,
because the package exports only process and container gauges. The same app is a Next.js app: the adapter turns the
http instrumentation off (Next.js spans its requests itself), so the app has no `http.server.request.duration` at all
and no alert can see a run of 5xx answers.

## Scope

- `instrumentations.host` (default on): `system.memory.*` from `/proc/meminfo`, `system.cpu.utilization` from
  `/proc/stat` between collections, `system.cpu.load_average.1m`, `system.cpu.logical.count`, and
  `system.filesystem.limit|available|utilization` per path (`statfs`, default `/`) with `system.filesystem.mountpoint`.
- `instrumentations.serverSpanMetrics` (default on when `http` is off): `http.server.request.duration` from root
  server spans, by method, status code and route (`http.route` or `next.route`), never by path; also when trace export
  is off.
- Tests, README, CHANGELOG; release as a minor (0.9.0): new default series.

## Notes

- Research and frame skipped: the gaps were read directly from `start.ts`, `config.ts` and the Next.js adapter, and
  confirmed in Grafana (no request metric and no host gauge for the app's services).
