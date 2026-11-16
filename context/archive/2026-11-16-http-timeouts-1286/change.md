---
change_id: http-timeouts-1286
title: "core, observability, host, agent-ready: deadlines on external HTTP calls (issue #1286)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1286
branch: claude/qr-timeouts-rr724b
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1286](https://github.com/SOFTURE/AI/issues/1286): five findings of a whole-repository quality review
(`QR-6531dba7`, `QR-204390fb`, `QR-2759de3a`, `QR-ceee2248`, `QR-b385f413`). External HTTP calls get a deadline, and
the agent-ready skills index is narrowed with a schema.

## Context

Labels: `bug`, `pkg: core`, `pkg: host`, `pkg: agent-ready` (no `pkg: observability` label exists). Packages: core
0.2.7, observability 0.8.4, host 0.1.2, agent-ready 0.2.1. No version bump: the batch release follows.

## Scope

- core `createOgFontLoader`: `timeoutMs` (default 10 s) on URL fonts.
- observability `applyGrafanaResources`: `timeoutMs` (default 30 s) per call.
- host `createCloudflareApi`: third argument `timeoutMs` (default `CLOUDFLARE_TIMEOUT_MS`, 30 s).
- agent-ready CLI: every request 10 s (`timeoutMs` of `runAgentReadyCli`); skills index through a zod schema.
- Tests for every timeout path; CHANGELOG `## Unreleased` of the four packages.

## Constraints

- A timeout is reported the way a network failure already is; no new result kinds.

## Notes

- Research: skipped. Each call site was read in the review; `AbortSignal.timeout` is the pattern the repository
  already uses (`foundation/core/src/http-json.ts`, `modules/seo/src/server/indexnow.ts`).
- Framing: skipped. The problem is a missing deadline at known call sites.

## Done

- `@softure-ai/core`: URL OG fonts time out after 10 s (`timeoutMs`); a timed-out font is not cached.
- `@softure-ai/observability`: each Grafana call of `grafana apply` times out after 30 s (`timeoutMs`).
- `@softure-ai/host`: each Cloudflare call times out after 30 s (`CLOUDFLARE_TIMEOUT_MS`).
- `@softure-ai/agent-ready`: CLI requests time out after 10 s; the skills index is parsed with a schema.
- Next release of the four packages (patch).
