---
change_id: observability-standalone-runtime
title: "observability: registerObservability starts under a standalone Next.js server (issue #381)"
status: plan_reviewed
roadmap_item: null
issue: 381
branch: claude/project-thread-ht8g57
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #381](https://github.com/SOFTURE/AI/issues/381): `registerObservability` from
`@softure-ai/observability/next` returns `null` unless `process.env.NEXT_RUNTIME === "nodejs"` at runtime. Only the
`next` CLI sets that variable, so an app built with `output: "standalone"` and started as `node server.js` exports
nothing and prints nothing.

1. `registerObservability` starts observability whenever it does not run in the edge runtime, including when
   `NEXT_RUNTIME` is unset.
2. It still does nothing in the edge runtime.
3. A test runs the adapter with `NEXT_RUNTIME` unset.

## Context

Issue #381 (labels `bug`, `pkg: observability`, `adoption`). No roadmap item; the PR closes the issue. No version
bump: the fix rides the next combined release under `## Unreleased` in the CHANGELOG.

## Constraints

- Scope: `foundation/observability` only (`src/next/index.ts`, `tests/next.test.ts`, README, CHANGELOG).
- The entry still imports nothing from `next`.

## Notes

- Research: skipped. The issue names the cause and the fix; checked against Next.js 16.3.8 in `node_modules`:
  `next/dist/bin/next` sets `NEXT_RUNTIME = 'nodejs'` (the standalone `server.js` does not run it), and the edge
  sandbox (`server/web/sandbox/context.js`, `buildEnvironmentVariablesFrom`) always sets `NEXT_RUNTIME` to `edge`
  and runs inside `edge-runtime`, which defines the `EdgeRuntime` global.
- Framing: skipped. The problem is observed in an adopting app and the issue's proposal is taken.
