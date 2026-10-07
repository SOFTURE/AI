# Implementation review: mailing-adoption-gaps

Reviewed: the branch diff against master `518ef61` (commits `9a7fda2`, `49c0d8f`, `90f5559` and the phase 4 commit)
against plan.md, plan-review.md and AGENTS.md. Effort: high.

## Plan conformance

All five points of issue #195 are implemented as planned; every Progress item is backed by a test that was seen red
on the old sources (send-mail, resend, messages, deliveries, campaigns, module, suppressions, next-unsubscribe,
billing reminder-mail) and green after. No drift from the key decisions.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | docs/02 §12 asks for at least a minor version for a database schema change, and migration `0003` alters `mailing.deliveries`. A 0.2.0 would fall outside the `^0.1.0` ranges billing and waitlist declare for mailing, so both would need new ranges and releases for an additive column and a relaxed check. | Kept 0.1.7, as every earlier 0.1.x migration did (billing, auth). The migration is additive and older code ignores the column; recorded here. |
| 2 | Warning | The example app keeps its own error dictionary keyed by code; it had no copy for the two new codes, so a halted send would show its generic fallback. | Fixed: en/pl entries added in `examples/next-app/messages`. |
| 3 | Suggestion | The waitlist's welcome mail treats `halted` like any other non-`rejected` outcome and logs nothing of its own. | No change: `sendMail` already logs `reason=provider_refused status=401`, and the delivery stays `pending`, so the next sign-up attempt sends it. |
| 4 | Suggestion | A lifecycle delivery that becomes `uncertain` (a crash, then nothing for 23 hours) is never sent by itself; billing counts it as skipped. | Accepted by design (plan-review #2): the README says how to retake it; the alternative is a possible double send. |
| 5 | Suggestion | `readUnsubscribeLink` moved inside the route's `try`, so a configuration error now answers 500 instead of throwing out of the handler. | Better behaviour, kept. |

Security re-check: legacy values are capped at 512 characters and rendered by React (escaped); `verify` errors are
logged by label only (test asserts the link value is absent); a signed link never reaches `verify` (test); nothing
of a mail reaches logs or results (the new `httpStatus` is a number).

No open findings. Verdict: ready to merge once `npm run typecheck`, `lint`, `test` and `build` are green.
