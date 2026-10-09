---
change_id: auth-guard-fixtures-admin-emails
reviewed: 2026-10-09
verdict: approved
---

# Implementation review: auth-guard-fixtures-admin-emails

Checked the diff against plan.md and change.md and ran the gates.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The relative redirect is built from the same `URL` as the absolute one, so the route override and `next` encoding match; it reads no header. | No change. |
| 2 | Check | `runHooks` without a context throws before any write; a throwing hook rolls back the account and its roles. | No change. |
| 3 | Suggestion | The hash memo lives for the process; a suite that rotates passwords per test gains nothing but loses nothing. | No change. |
| 4 | Check | Every earlier auth test passes unchanged (353 tests in the package). | No change. |
| 5 | Critical | Making `TestAccountInput` a union broke `Omit<TestAccountInput, "scrypt">` in the example app's e2e helper (the container build's typecheck caught it): an adopter deriving from the type would break the same way. | Fixed: `TestAccountInput` stays the password interface (new optional fields only); the hash form is a separate `TestAccountHashInput`. |

Gates: `npm run typecheck`, `npm run lint`, `npm run build` green; the auth package tests green; full `npm test` runs
in the pre-push hook.
