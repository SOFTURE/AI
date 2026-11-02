---
change_id: mcp-access-operations-952
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: mcp-access-operations-952

Reviewed commits 22897e4 and c5f71c1 against plan.md and issue #952.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Minor | A duplicate start whose live job ends between the enqueue and the read answers `queued` with the job's id. | Kept: the next `get_operation` answers the real outcome; the window is one statement long. |
| 2 | Minor | A throwing `readResult` fails the status call. | Kept: `withToolErrors` answers the generic text and logs the error's kind only; the job itself is unchanged. |
| 3 | Minor | `startOperation` lets database failures propagate. | Documented; the README example wraps it in `withToolErrors`, as every tool. |

- Items 1 to 3 of the issue are in `@softure-ai/mcp-access/jobs`; item 4 (MCP Tasks) is follow-up #977
  (change.md Decisions).
- Ownership: origin `mcp` plus the `mcp:<userId>:` dedup key prefix; tests cover another account's id, a job that is
  not an operation (even one whose key carries the prefix but another origin), a malformed and an unknown id, for both
  tools, and that a foreign cancel leaves the job pending.
- Status mapping, progress only while running, the growing and clamped wait, `result` via `readResult`, `errorCode`
  for failed and cancelled, `cancelRequested` for a running job asked to stop; the cancel tool is absent for a
  read-only identity. Calls go through the SDK in JSON mode.
- No jobs migration, no change in `modules/jobs`; `/server` still never imports jobs.
- README (§1, "Long operations", §12) and CHANGELOG `Unreleased`. No version bump.
- Gates: typecheck, ESLint, language gate green; mcp-access tests 409/409 (16 new).

Verdict: approved.
