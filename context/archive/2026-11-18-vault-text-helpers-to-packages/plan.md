# Plan: vault-text-helpers-to-packages

One phase, test-after (code and tests move together from the app): `foundation/core/src/fold-text.ts` with
`foldText`/`foldWords` and `tests/fold-text.test.ts` (the app's cases, split between the two functions);
`modules/mcp-access/src/server/untrusted.ts` with `createUntrustedWrapper` and `tests/untrusted.test.ts` (the app's
cases plus refusal of blank or equal markers). README and CHANGELOG of both packages; patch bumps.

Done when: typecheck, lint and the two packages' tests are green; the adopting app's existing tests pass on the
package functions unchanged.

## Progress

- [x] Phase 1: core folding (5 tests) and mcp-access untrusted wrapper (5 tests), README, CHANGELOG.
