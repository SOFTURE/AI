---
change_id: observability-stable-http-545
status: archived
---

# Plan: stable HTTP server attributes (issue #545)

Input: change.md, research.md. Complexity: small (one processor, one option, tests, docs).

## Phase 1: processor (TDD)

Files: `foundation/observability/src/node/stable-http-attributes.ts`, `tests/stable-http-attributes.test.ts`.

1. Tests first: a SERVER span ended with only `http.status_code`, `http.method` and `http.target=/a?b=1` exports
   both keys of each pair and `url.path=/a`; a present stable key is kept; a CLIENT span is untouched.
2. `StableHttpAttributesProcessor` (`onEnding` copies each missing stable key).

## Phase 2: wiring

Files: `src/node/config.ts` (`traces.stableHttpAttributes`), `src/node/start.ts`, `src/next/index.ts`,
`tests/next.test.ts`.

1. The processor joins the span processors when traces are exported and the option is on.
2. `registerObservability` defaults it to `true`, an explicit `false` wins.

## Phase 3: docs

`README.md` (the mapping, the query key until an app runs this version), `CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: processor
- [x] Phase 2: wiring
- [x] Phase 3: docs

Phase 1 tests (`stable-http-attributes.test.ts`) were red before the processor existed; the three wiring tests were
red before `start.ts` and `next/index.ts` changed. Gates on the branch: typecheck, lint, build and `npm test`.
