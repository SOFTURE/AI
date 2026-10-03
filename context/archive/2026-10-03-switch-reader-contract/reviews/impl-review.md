# Implementation review: switch-reader-contract

Reviewed: commits 0d17c24 (phase 1) and 5e57620 (phase 2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, 2224 unit tests, build);
`npm run e2e` on PostgreSQL 16: 78 passed, including
`e2e/registration-switch.serial.spec.ts` in the dependent `serial` project.

## Drift from plan

- The reader lives in `src/server/reader.ts` and is exported from `/server` as
  `readDeclaredSwitch` next to `listUndefinedManifestSwitches`.
- The login page now also drops its register link through the provider (it already followed the
  option); the e2e checks it.
- `e2e/feature-switches.spec.ts` scopes its "default value" check to the banner's row: the
  example now declares two switches that both read as default.
- The panel's report is a `region` labelled by its title, with a new `undefined` slot.

## Findings

### W1 [WARNING] A module built by an older core has no `switchReader` field
**Where:** `findSwitchReader`, the provider check in `defineSoftureConfig`
**Problem:** a module packed against the previous core yields `undefined`, not `null`; a
`!== null` test would take it for a provider and call `undefined`.
**Decision:** Fixed - both checks test `typeof … === "function"`, with a comment.

### W2 [WARNING] Closing registration in the shared e2e database
**Where:** `examples/next-app/playwright.config.ts`
**Problem:** with `fullyParallel`, any spec registering while the switch is on would fail.
**Decision:** Fixed - `*.serial.spec.ts` runs in a project that depends on the parallel one, and
the spec's `afterAll` deletes the row even after a failure, which reopens registration.

### S1 [SUGGESTION] Auth's fallback env parsing differs from feature-switches'
**Where:** `modules/auth/src/server/switches.ts`
**Problem:** without a provider, auth accepts `true/1/false/0`; feature-switches also takes
`on/off`. The same variable reads differently depending on whether the switch is defined.
**Decision:** Accepted - documented in auth's README §6; aligning auth's parser is a behaviour
change outside the roadmap outcome and is cheap to do later if an app trips on it.
