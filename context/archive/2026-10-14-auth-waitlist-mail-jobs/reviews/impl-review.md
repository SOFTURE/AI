# Implementation review: auth-waitlist-mail-jobs

Reviewed: commits dcf6bed, f3ccc72, 76ba2bb and the review fix against plan.md. Verdict: ready once jobs 0.1.0 is on
the main branch. Findings: 0 critical, 2 warnings (fixed or recorded), 0 suggestions open.

## Drift from the plan
None. Every key decision is implemented as planned; the waitlist outcome type is named `attempted` (not
`delivered`), since a failed send is also an attempt.

## Findings
- Warning (fixed): the waitlist handler let a throw reach the jobs logger, which logs the error itself; an app's
  `mailTemplate` error could carry the link. The handler now logs only the error's label and returns
  `waitlist.confirmation_mail_failed` (retried), like auth's `auth.password_reset_send_failed`. Test added.
- Warning (recorded): with `confirmationMail.enqueue`, `rewriteConfirmationLink` runs in the worker, without request
  scope; a rewrite that reads the request (analytics' `tagRedirect`) falls back to the module's link. Documented in
  the README and the CHANGELOG; the default path keeps the old behaviour.

## Tests
Auth 7 new (`password-reset-job.test.ts`), waitlist 9 new (`confirmation-mail-job.test.ts`, one in
`next-join.test.tsx`), payloads asserted free of the address and the token. They need jobs 0.1.0 on the main
branch: core refuses `"jobs": "^0.1.0?"` against the unreleased 0.0.0 manifest. Run locally with the range relaxed:
563 of 565 green, the two failures being the relaxed range itself (module.json equals the manifest).

## Decisions (auto)
- Own handlers instead of the mailing delivery job of #492: a link must be minted at send time, and the ledger's
  stable idempotency key across retries would void the delivered link (asked the #492 thread; switch later if its
  API allows it without dead links).

## After merging the main branch (2026-10-15)
- #491 added `@softure-ai/auth/jobs` and `@softure-ai/waitlist/jobs` with `authJobHandlers` and `waitlistJobHandlers`
  for the prune schedules, and raised the jobs peer to `^0.1.1`. The mail handlers were renamed to
  `passwordResetJobHandlers` and `confirmationMailJobHandlers` and kept apart: a worker refuses a handler for a queue
  the config does not define, so an app that only adopts the prunes must not get the mail queues with them.
