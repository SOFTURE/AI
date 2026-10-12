# Implementation review: auth-only-account-seed-411

Reviewed: the branch diff against plan.md, change.md and issue #411.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. The resolver moved to auth unchanged in behaviour (trim, uuid check before the query, at most two rows read, never the first of several). | No change. |
| 2 | Check | mcp-access keeps its three `mcp-access.stdio_*` codes and messages byte for byte; `adoption-gaps-315.test.ts` passes untouched. The `switch` is exhaustive over `OnlyAccountErrorCode`, so a new code fails typecheck there. | No change. |
| 3 | Check | The seed never prints the password; database errors are reduced to their label (the insert carries the hash). A throwing hook rolls the account back (tested). | No change. |
| 4 | Check | The seed ends the session registration opens, so a seeded database has no stray session (tested). | No change. |
| 5 | Warning | mcp-access's `@softure-ai/auth` range stays `^0.1.0` until auth is released; a consumer on `auth@0.1.12` would miss the export. | Recorded under "Before the next release" in change.md and in the mcp-access CHANGELOG. |

Gates: see plan.md Progress.
