---
change_id: waitlist-consent-gate-557
reviewed: 2026-10-17
verdict: approved
---

# Plan review: waitlist-consent-gate-557

Checked plan.md against change.md, research.md, issue #557 and `signups.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The issue proposes `requiredConsent`; `scopes[].required` already carries it, so the plan reuses it and records why (Decisions (auto)). | No change. |
| 2 | Check | Moving `checkScopes` first also answers `form_invalid` before `email_invalid` for a tampered form; both are pure checks and neither leaks anything about the address. | No change. |
| 3 | Check | The client rate limit stays first, so every refused form still costs one attempt; the per-address limit stays after the checks, so a refused consent does not spend the address's attempts. | No change. |
| 4 | Check | Apps without a required scope: the only visible difference is an empty form with a malformed address now answers `consent_required`; the test pins both cases. | No change. |

No Critical findings.
