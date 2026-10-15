# Plan: billing-e2e-pin-trials-race

Input: change.md, research.md. Complexity: small (one phase).

## Goal

The `pin-trials` case runs with no other spec writing to the database, so neither the 23503 nor the
`accountsWithoutRow` count can be broken by another worker.

**Out of scope:** `pinDerivedTrials` itself, any package release, any adopting app.

## Key decisions

- New file `examples/next-app/e2e/billing-pin-trials.serial.spec.ts` holding the case unchanged in what it
  asserts, with its own account cleanup.
- `serial` project gets `workers: 1`, so serial specs also never overlap each other (registration closed
  in one would break sign-up in another).
- `billing-entitlements.spec.ts` drops the case and its header line; `runBillingScript` stays there for
  `import-entitlements`.

## Phase 1: Run pin-trials alone

- Move the case; set `workers: 1` on the `serial` project and say why in the config comment.

Done when: `npm run typecheck`, `npm run lint`, `npm test` green, and the billing e2e specs pass locally
against Postgres.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Run pin-trials alone

#### Automated
- [x] 1.1 pin-trials case in its own serial spec; serial project runs one worker — 81c3d6f
- [ ] 1.2 Typecheck, lint and test green; billing e2e green locally
