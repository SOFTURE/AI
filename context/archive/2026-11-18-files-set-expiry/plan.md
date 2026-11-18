# Plan: setFileExpiry (files)

## Approach

One function in `src/server/files.ts` next to `deleteFile`: a conditional `UPDATE ... WHERE id AND live AND owner`
returning the row, so the read and the write are one statement.

## Phases

### Phase 1: function, tests, docs, version (test-first)

- `tests/files.test.ts`: clearing the expiry keeps the file through a prune past its old expiry; setting a date lets
  the prune take it; another owner's, a deleted, an expired, a malformed and an unknown id answer `files.not_found`
  and change nothing.
- `src/server/files.ts`, `src/server/index.ts`; README (API list), CHANGELOG 0.6.0;
  `npm run release:version -- files minor`.
- Done when: `npx vitest run modules/files` passes; typecheck and ESLint clean.

## Progress

- [x] Phase 1: function, tests, docs, version
