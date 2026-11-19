# Plan: mcp-endpoint-limit-per-token

## Phases

### Phase 1: two fixes (TDD)

- Endpoint tests (`endpoint.test.ts`, "the rate limit"): a token at its limit gets 429 with `Retry-After: 900` while
  another account's token on the same address gets 200; a limit's worth of bad tokens from one address gets 429 there,
  while another address gets 401 and a valid token on the same address gets 200. Code in `serve()`.
- Diagnostics test (`request-diagnostics-1066.test.ts`): a streamed 2 MiB body without `Content-Length` gives an entry
  with no method and a 413. Helper `peek-body.ts`, used by both readers.
- Done when: `npx vitest run modules/mcp-access tests/repo` passes; `npm run typecheck` and ESLint clean.

## Progress

- [x] Phase 1: two fixes

Evidence: `npx vitest run modules/mcp-access tests/repo` 74 files, 1802 tests green; `npm run typecheck`, ESLint on `modules/mcp-access` and the language gate clean.
