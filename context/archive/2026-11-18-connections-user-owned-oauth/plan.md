# Plan: OAuth connections owned by each signed-in user

## Approach

Add an owner to the existing row and thread it through every call, keeping `null` as "the app" so nothing changes for
an app that declares no user provider.

## Phases

### Phase 1: data and options

- `options.ts`: `owner`, `returnPath`, `subjectField`, `keysEnv`, `accountReturnPath`; a user provider without
  `returnPath` is refused at startup.
- Migration 0003 and `schema.ts`; sealing context with the owner; `readKeyring` with the configured variable.
- Done when: typecheck clean; module defaults test updated.

### Phase 2: server calls

- `resolveOwner` (wrong_owner for a missing or misplaced owner), `whereConnection`, `findAccount` with the owner;
  flow (start stores the owner, `ownOnly`, failure target, subject capture), tokens, credentials, request, list,
  rotate, privacy.
- Tests: `tests/owned-connections.test.ts` (two users, isolation, sealing bound to the owner, wrong_owner both ways,
  ownOnly, panel listing, disconnect, privacy export and delete, subject shape, option validation); existing tests
  updated for `ownerId` in events and results.

### Phase 3: Next adapter

- Callback route for any signed-in user; `startOwnConnectionAction`, `disconnectOwnAction`, `listOwnConnections`;
  the admin start refuses a user provider.
- Tests: `tests/next-owned.test.ts`.

### Phase 4: docs, version

- README sections 3, 4, 5, 11; CHANGELOG; `npm run release:version -- connections minor` (0.7.0).

## Progress

- [x] Phase 1: data and options
- [x] Phase 2: server calls
- [x] Phase 3: Next adapter
- [x] Phase 4: docs, version

Evidence: `npx vitest run modules/connections` 221 tests (217 passed, 4 skipped Postgres-only, as before); root
`npm run typecheck` and `npm run lint` clean.
