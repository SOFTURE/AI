---
change_id: waitlist-consent-gate-557
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: waitlist-consent-gate-557

Reviewed: the branch diff against plan.md, change.md and issue #557.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `joinWaitlist` spends the client attempt first, then `checkScopes`, then `normalizeEmail`; the per-address limit, the suppression check, the write and the mail all stay behind the checks. | No change. |
| 2 | Check | Acceptance "writes nothing, sends nothing, costs one attempt": pinned by `consent-gate-557.test.ts` (no row, no consent, no mail, client bucket spent, address bucket not). | No change. |
| 3 | Check | Acceptance "apps without `requiredConsent` behave as today": no new option; an app without a required scope keeps `email_invalid` for a malformed address with a scope checked (tested). The one visible shift, an empty form with a malformed address, is in the CHANGELOG. | No change. |
| 4 | Check | `joinWaitlistAction` already maps `consent_required` to `field: "consent"`; the existing action tests pass unchanged. | No change. |
| 5 | Check | CHANGELOG `## Unreleased` with the migration, README scopes row; no version bump (batched releases). | No change. |
