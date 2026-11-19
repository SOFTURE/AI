# Plan: mcp-access-oauth-hardening

## Phases

### Phase 1: three fixes (TDD for L1 and L2)

- L1 test (`oauth-http.test.ts`): a limit's worth of made-up ids from one address gets 429, a registered client from the
  same address still gets its own room, and only two counter rows exist. Code in `handleTokenRequest`.
- L2 test (`routes-consent-headers.test.ts`) and the example's OAuth e2e header check; `routes.ts` helper; example
  `next.config.ts`.
- L3: README paragraph under "Confirmed calls".
- Done when: `npx vitest run modules/mcp-access tests/repo` passes; `npm run typecheck` and ESLint clean.

## Progress

- [x] Phase 1: three fixes

Evidence: `npx vitest run modules/mcp-access tests/repo` 74 files, 1800 tests green; `npm run typecheck` clean; ESLint
clean on `modules/mcp-access`. The example e2e header check runs in CI (example app e2e).
