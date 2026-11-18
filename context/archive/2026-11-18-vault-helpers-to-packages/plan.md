# Plan: vault-helpers-to-packages

One phase per package, test-after (the code and its tests move together from the app):
files `createFakeS3` with the app's driver tests plus listing, signature and failure-injection tests; security
`client-ip-env.ts` with the app's tests plus `clientIpFromEnv`; analytics `getFunnelDays` rewritten as one grouped
query (the app read one report per window) with tests on PGlite, and `formatFunnelDays` taking the report.
README and CHANGELOG of each package; patch bumps.

## Progress

- [x] Phase 1: files `createFakeS3` (6 tests).
- [x] Phase 2: security client-IP from the environment (11 tests).
- [x] Phase 3: analytics funnel per day (5 new tests, 27 in the file).
