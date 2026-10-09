---
change_id: ops-main-and-bucket-key-kinds
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: ops-main-and-bucket-key-kinds

Checked plan.md against change.md, issue #328, `ops/src/scripts/ops-script.ts`, `security/src/options.ts`,
`security/src/server/options.ts` and every `consumeRateLimit` call.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Setting `process.exitCode` in tests leaks into Vitest's own exit code. | Accepted: the test saves and restores `process.exitCode` around each case. |
| 2 | Warning | A required `key` (as the issue's wording suggests) breaks every adopting config on upgrade. | No change: decision 2 keeps it optional; every package default declares it, so spread defaults are complete. |
| 3 | Warning | `mcp-oauth` token requests are keyed by address plus client id; calling that `"account"` would hide IP processing from a privacy listing. | Accepted: decision 2 defines `"ip"` as any key that contains the client address. |
| 4 | Suggestion | `overrideBuckets` could accept new bucket names too. | No change: adding a bucket is a plain spread; refusing unknown names catches typos. |
| 5 | Check | The config-shape probe in `runOpsMain` matches core's `isConfigLike` (`modules` array, `database` key). | No change. |

No Critical findings. Research and framing skips are justified in change.md.
