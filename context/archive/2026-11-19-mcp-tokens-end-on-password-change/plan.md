# Plan: mcp-tokens-end-on-password-change

## Approach

Compare each token's, grant's and code's `created_at` with the account's `password_changed_at`: joins in the reads,
a lookup inside the OAuth transactions, an `IN (select …)` in the prune deletes.

## Phases

### Phase 1: end earlier tokens (TDD)

- Test first (`tests/password-change.test.ts`): a hand-issued token from before the change is refused and unlisted,
  one from after and another account's stay; same instant stays; a connected app's access token, refresh and list
  entry end; a code from before is refused; prune deletes exactly the ended rows.
- Code in `tokens.ts` and `oauth.ts`; README and CHANGELOG (Unreleased).
- Done when: `npx vitest run modules/mcp-access` passes, `npm run typecheck` and ESLint on the changed files are clean.

## Progress

- [x] Phase 1: end earlier tokens

Evidence: new tests 4 of 6 red before the code; `npx vitest run modules/mcp-access` 41 files, 559 tests green;
`npm run typecheck` clean; ESLint clean on the changed files.
