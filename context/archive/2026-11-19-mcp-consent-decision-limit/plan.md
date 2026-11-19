# Plan: mcp-consent-decision-limit

## Phases

### Phase 1: count the decision (TDD)

- Test (`oauth-http.test.ts`, "the consent decision"): a limit's worth of `allow` gets 303, the next 429 with
  `Retry-After: 900`, the codes table holds exactly the limit, and another account still gets 303.
- Done when: `npx vitest run modules/mcp-access` passes; typecheck and ESLint clean.

## Progress

- [x] Phase 1: count the decision

Evidence: `npx vitest run modules/mcp-access` 42 files, 565 tests green; typecheck, ESLint and the language gate run in
the pre-commit hook.
