# Plan: quality-review-security-jobs-deploy

## Phases

### Phase 1: security webhook (TDD)

- Tests (`webhook.test.ts`): a resend of the same signed body with a new delivery id header answers 200 and skips the
  work; a failing handler logs only the error's kind (`Error`), not its message.
- Done when: `npx vitest run modules/security` passes.

### Phase 2: jobs hooks and poll (TDD)

- Tests: a hook that never settles is logged as timed out after `hookTimeoutMs` and the worker goes on; the hook's
  signal is aborted; `err("socket hang up")` stores `jobs.handler_threw`, an over-long dotted code its first 200
  characters; a status poll that hangs ends as `network` after its time limit.
- Done when: `npx vitest run modules/jobs` passes.

### Phase 3: deploy exports (test-after)

- Drop the `export` of the nine constants and `getVerifyTables`; nothing outside their modules imports them.
- Done when: `npx vitest run tools/deploy` passes and typecheck is clean.

## Progress

- [ ] Phase 1: security webhook
- [ ] Phase 2: jobs hooks and poll
- [ ] Phase 3: deploy exports
