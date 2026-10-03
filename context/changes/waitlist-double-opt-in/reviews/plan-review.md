# Plan review: waitlist-double-opt-in

Reviewed: plan.md against change.md, research.md and the roadmap item FU-2 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 4 warning, 1 suggestion.

## Lenses

- Outcome coverage: `confirmed_at` (migration), the link in the mail sent at sign-up, list mail and
  consent rows waiting for the confirmation, both unknowns answered; unit and e2e tests named.
- Data integrity: the pending request, the token and the confirmation live on one row under a row
  lock; checks tie the new columns together; the backfill keeps current sign-ups counted.
- Security and abuse: a link that grants consent, mail to arbitrary addresses, scanners.
- API: `JoinWaitlistResult` changes shape.

## Findings

### W1 [WARNING] The join result changes shape for `/server` callers
**Where:** `joinWaitlist`.
**Problem:** `result.value.recordedScopes` now needs a narrowing on `status`.
**Decision:** Accepted - the package is unpublished (`0.0.0`, the owner's first batch release is
on 2026-10-05), the union is what the convention asks for, and the README shows both branches.

### W2 [WARNING] Anyone can make the module mail a confirmation link to any address
**Where:** the pending path and `deliverConfirmationMail`.
**Problem:** the mail is transactional, so it also reaches an address that opted out.
**Decision:** Accepted - it is the purpose of double opt-in (the owner must be asked), bounded by
the `waitlist-email` bucket (3 per hour per address) and `waitlist` per client; the mail carries
nothing but the link and says to ignore it. README §12 states it.

### W3 [WARNING] The document version recorded is the one in force at confirmation
**Where:** `recordConsents` at confirmation.
**Problem:** if the privacy policy changes between the form and the link, the ledger names the newer
version, which the person did not see on the form.
**Decision:** Fixed in the plan - the confirmation page states what the person confirms (the
consent labels are the app's, so the page says they confirm the sign-up made with this address);
the window is bounded by the expiry and README §11 states it. Storing the version per pending scope
would need a ledger input privacy does not take.

### W4 [WARNING] A confirmation shares the `waitlist` client bucket with sign-ups
**Where:** `confirmSignup`.
**Problem:** a person who tried the form several times could be throttled on the link.
**Decision:** Accepted - 10 per 15 minutes per client; the page answers `limited` with the
security copy and keeps the token for a retry. A separate bucket would be one more setup step for
every app.

### S1 [SUGGESTION] Confirm on GET for one click fewer
**Decision:** Rejected - mail scanners and previews open links; the mailing unsubscribe page
follows the same rule.

## Triage summary

All warnings decided; nothing pending.
