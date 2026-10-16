---
change_id: db-drizzle-after-ledger-534
reviewed: 2026-10-16
verdict: approved
---

# Plan review: db-drizzle-after-ledger-534

Checked plan.md against change.md, research.md, issue #534 and `drizzle.ts` / `migrator.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | An app that already runs a shared-ledger `after` folder in production starts failing after the upgrade; switching it to a new ledger would re-apply its files there. | Taken: the CHANGELOG says to copy the `after` files' rows (matched by `hash`) into the new ledger before the first run. |
| 2 | Check | The default ledger is unchanged, so a `before`-only app re-applies nothing. | No change. |
| 3 | Check | The fixture for `after` must be older than the `before` fixture, or the test passes without the fix. | No change; the plan names it. |
| 4 | Check | The refusal must also hold in `planMigrations`, so `--plan` shows it before a deploy. | No change; the plan names both. |

No Critical findings.
