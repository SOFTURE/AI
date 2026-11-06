---
change_id: stripe-sandbox-diagnostics
title: "e2e: the Stripe sandbox payment pays in PLN under Adaptive Pricing and a failure says what Checkout showed"
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

The first diagnostic run (job 128008815300) showed the cause: Checkout now offers Adaptive Pricing, preselects USD
($7.65, "includes 4% conversion fee") on the US runner next to PLN 29.00, and after Pay shows "There was an error
processing your request." The test now picks the plan's own currency (PLN) when the currency choice is shown.

## Done

On a failed run the job prints Playwright's error context (URL and ARIA snapshot of the page Stripe showed) and the
listener's log; the test's timeout error names the page's URL and Stripe's alerts and field errors. The test pays in the plan's own currency when Checkout offers a converted one.
