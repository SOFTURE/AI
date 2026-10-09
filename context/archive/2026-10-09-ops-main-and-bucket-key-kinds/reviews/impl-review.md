# Implementation review: ops-main-and-bucket-key-kinds

Reviewed: the branch diff against plan.md, change.md and issue #328.
Verdict: **approve** (one fix applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | The six package bucket constants now carry `key`, which `@softure-ai/security` 0.1.7's strict bucket schema refuses. An app that upgrades auth (or any of the five) but keeps security 0.1.7, which `^0.1.0` allows, would fail at startup with `Unrecognized key: "key"`. | Fixed: the six packages require `@softure-ai/security` `^0.1.8` (dependencies and peer ranges, package-lock), noted in each CHANGELOG. security must be released first in the wave. |
| 2 | Check | `runOpsMain` sets `process.exitCode` and never calls `process.exit`, so output flushes and the pool closes (`runOpsScript` closes it in `finally`). A config module without a config fails before a database is opened (test). An unexpected throw is one line and exit 1, never an unhandled rejection (test). | No change. |
| 3 | Check | `key` stays optional: the existing module tests (options without `key`) pass unchanged; `listRateLimitBuckets` reports `undefined` for such buckets (test). | No change. |
| 4 | Check | Each package's kinds match its `consumeRateLimit` calls (plan.md, Today); `mcp-oauth` is `"ip"` because token requests include the address. The blog module test that pins the exact defaults now includes `key: "ip"`: an extension of the asserted value, not a loosened test. | No change. |
| 5 | Check | `satisfies Readonly<Record<string, RateLimitBucketInput>>` uses a type-only import; the built `.d.ts` of blog (where security is an optional peer) holds no import of `@softure-ai/security`. | No change. |
| 6 | Check | Docs: ops README entry uses `runOpsMain` with the CommonJS explanation; security README options table, key kinds, listing and overrides, GDPR note; auth README config and rate-limit paragraph; CHANGELOGs and patch bumps in all eight packages. | No change. |

Gates: see plan.md Progress.
