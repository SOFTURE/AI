# Plan review: testing-core-test-time-zone

Reviewed: plan.md against change.md, issue #251, `foundation/testing/src/vitest/`, the root `vitest.config.mts`,
`foundation/core/src/clock.ts` and the day helpers in billing, blog, privacy and mcp-access.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Tests that switch `TZ` leak the zone into later tests of the same file (random order). Every test that pins must restore `TZ` and `TEST_TZ`, and the restore must itself switch the zone back (an assignment, not a delete of a stubbed key only). | Accepted: `vi.stubEnv` for both keys and `vi.unstubAllEnvs()` in `afterEach`, which assigns the old value back; one test asserts the zone after a restore. |
| 2 | Warning | The worker-thread test loads `time-zone.ts` straight from source with Node's type stripping (default from Node 22.18; CI uses `node-version: 22`, the latest 22.x). The file must stay free of imports and of syntax that needs transformation (enums, parameter properties). | Accepted: noted in the file header. |
| 3 | Warning | Pinning before the clock shift changes when noon of `TEST_TODAY` is computed: it must be in the pinned zone, or a shifted day could fall on the previous date in New York. | Accepted: D2 order; the existing setup tests keep asserting local getters. |
| 4 | Suggestion | A behaviour change for apps that already list the setup file and pin another zone in their config: the setup would override it. `pinTestTimeZone(zone)` in the config stores the zone in `TEST_TZ`, which the setup honours; the README says so and the CHANGELOG names the change. | Accepted. |
| 5 | Check | `toCalendarDay` must not depend on the `en-CA` pattern: `formatToParts` and explicit padding. | Covered by D4. |

No migration, no API removal; new exports only.
