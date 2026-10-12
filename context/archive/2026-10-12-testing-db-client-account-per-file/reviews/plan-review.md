---
change_id: testing-db-client-account-per-file
reviewed: 2026-10-12
verdict: approved
---

# Plan review: testing-db-client-account-per-file

Checked plan.md against change.md, research.md, issue #412, `src/playwright/auth.ts`, `test-data.ts`,
`db/src/client.ts` and the browser test harness.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `vi.mock("pg")` must be hoisted above the import of the entry and mock the default export (`pg.Pool`), the shape the dynamic import reads. | Taken into Phase 1. |
| 2 | Warning | The language gate scans test fixtures too: test SQL and names stay English. | No change (already English). |
| 3 | Check | `countRows` values are bound; only validated identifiers enter the SQL text. | No change. |
| 4 | Check | `signInPerFile` keeps `registerAccount` / `logIn` unchanged; their defaults (`/register`, `/login`, `/account`) carry over. | No change. |
| 5 | Check | Progress matches the phases one to one; every phase ends with the gates item. | No change. |

No Critical findings.

## Decisions (auto)

- Approved with findings 1-2 folded in.
