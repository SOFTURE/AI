---
change_id: stripe-sandbox-diagnostics
title: "e2e: a failed Stripe sandbox payment says what Checkout showed and what Stripe recorded"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-xbnpsl
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Since about 15:20 UTC on 2026-11-06 the `Stripe sandbox payment` job fails on every run (master included, last green
15:15 on equivalent code): after paying on Stripe's hosted Checkout the redirect to `/payment?checkout=success` never
comes. The failure's screenshot and error context sit in an artifact that is not always reachable, so the log says
only "Timeout 60000ms exceeded". First step of stabilizing the test: make the cause visible in the job's log.

## Notes

- Research and framing: skipped. The change only reports what the page showed; the fix follows from what it reports.

## Finding

The diagnostic runs show Checkout answering Pay with "There was an error processing your request." and no event
reaching `stripe listen`. Checkout now also offers Adaptive Pricing (USD preselected on the US runner), but paying in
PLN fails the same way (job 128012964980), so the currency is not the cause; that attempt was reverted. The failed
step now also prints what Stripe recorded (the latest Checkout Sessions, PaymentIntents with their
`last_payment_error`, charges with their outcome), ids and error codes only.

## Done

On a failed run the job prints Playwright's error context (URL and ARIA snapshot of the page Stripe showed) and the
listener's log; the test's timeout error names the page's URL and Stripe's alerts and field errors. A failed run also prints Stripe's latest sessions, PaymentIntents and charges (ids, states, error codes).
