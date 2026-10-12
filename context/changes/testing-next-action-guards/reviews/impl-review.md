---
change_id: testing-next-action-guards
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: testing-next-action-guards

## Verdict

Approved. The six rules match the plan, each with passing and failing fixtures; existing guard exports are unchanged.

## Plan coverage

| Phase | Commit | Covered |
| --- | --- | --- |
| 1. Server-action guards | b08ad67 | `src/guards/next/*`, `./guards/next` export, 20 tests in `guards-next.test.ts` |
| 2. Comment stripping, string literals, docs | 8ad3724 | `stripComments`, `collectStringLiterals`, 6 tests, README section and default-filter note, CHANGELOG `Unreleased` |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Rule 2 first reported `refreshPage(config)` in mcp-access and `refreshAdminPage(config)` in billing: sync helpers that only revalidate and are called from success branches. | Fixed in phase 1: a sync function passes as a refresh helper (test added); the README says callers are not followed. |
| F2 | Check | Run over every module's `src/` and `examples/next-app/app`, `findServerActionProblems` reports nothing. | No change. |
| F3 | Check | Rule 5 does not flag a server component rendering a client component (`SaveForm` passes in `app/page.tsx`), only non-component names. | No change. |
| F4 | Check | `stripComments` keeps `//` in strings, template literals, regex literals and JSX text, and keeps every line break. | No change. |
| F5 | Suggestion | Rules 2 and 6 are syntax heuristics; an app with another success idiom may need an exemption. | Accepted: documented in the README; options cover naming. |

## Progress audit

Every ticked item has its proof: 1.1 `tests/guards-next.test.ts`, 2.1 the `stripComments` / `collectStringLiterals`
cases in `tests/guards.test.ts`, 2.2 README and CHANGELOG diff; gates by the pre-commit hooks and a local
`npm run lint`, `npm run typecheck`, Vitest over `foundation/testing` and `tests/repo` (550 passed) and the package build.

## Decisions (auto)

- F1 fixed during implementation; F5 accepted.
