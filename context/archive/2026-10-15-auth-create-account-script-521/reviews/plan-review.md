---
change_id: auth-create-account-script-521
reviewed: 2026-10-15
verdict: approved
---

# Plan review: auth-create-account-script-521

Checked plan.md against change.md, research.md, issue #521 and `temporary-password.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Count then insert is a check-then-write; two runs could both pass `maxAccounts`. | Taken: `LOCK TABLE ... SHARE ROW EXCLUSIVE` before the count, inside the script's transaction. |
| 2 | Warning | The email must not reach the report or the refusal text. | Taken: refusals are constant strings; the test checks the CLI lines. |
| 3 | Check | Copying `choosePassword` would fork the length rule between two scripts. | Taken: one shared helper. |
| 4 | Check | Invalid `maxAccounts` is a programming error, not a runtime refusal. | Taken: throws at creation, with the module prefix. |

No Critical findings.
