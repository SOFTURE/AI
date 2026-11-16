---
change_id: http-timeouts-1286
status: archived
---

# Plan: deadlines on external HTTP calls (issue #1286)

Input: change.md. Complexity: small (four call sites, one pattern).

## Phase 1: deadlines and the skills schema (TDD)

Files: `foundation/core/src/og/og-fonts.ts`, `foundation/observability/src/node/grafana/apply.ts`,
`tools/host/src/cloudflare/{api,index}.ts`, `modules/agent-ready/src/cli/run.ts`, their tests and CHANGELOGs.

- Tests first, with a fetch that settles only when its signal aborts: each caller reports its usual failure within a
  short `timeoutMs`; the OG loader asks again on the next call; the agent-ready check fails a skills index without a
  list. They fail (hang past the test timeout) on master.
- Then `AbortSignal.timeout(timeoutMs)` on each request; the agent-ready CLI wraps its fetch once, so every check
  inherits the deadline; `skillsIndexSchema` replaces the cast.

## Decisions (auto)

- Defaults: 10 s for a font and a CLI check (one small file each), 30 s for Grafana and Cloudflare writes (API calls
  that can be slow under load).
- One option name, `timeoutMs`, as in `foundation/core`'s HTTP helpers.

## Progress
- [x] Phase 1: d75491f (`npx vitest run foundation/core foundation/observability tools/host modules/agent-ready`: 1010 passed; the 5 new tests failed on master)
