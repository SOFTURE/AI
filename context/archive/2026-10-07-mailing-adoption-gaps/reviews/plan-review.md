# Plan review: mailing-adoption-gaps

Reviewed: [plan.md](../plan.md) against change.md, issue #195, the mailing and billing sources on master `518ef61` and
the rules in AGENTS.md. Effort: high (a ledger, a migration, an unsubscribe path that writes without a session).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | A halt releases the claim but the claim already counted an attempt. After a few runs with a bad key, the first `unavailable` after the fix reaches `maxAttempts` and closes the delivery as `rejected` for good: the very loss point 2 is about, one step later. | Accepted: a halt gives its attempt back (`attempts - 1`); migration `0003` relaxes the check to `attempts >= 0`. The fence stays sound: only the holder of the latest attempt can release, and a `pending` row cannot be closed. Test: five halted runs, then an `unavailable` still retries. |
| 2 | Warning | `uncertainClaimMs` defaulting to 23 h changes behaviour for apps already on 0.1.6: a claim older than that, which used to be retaken, now waits for the operator. | Accepted as the safer default (a retake after the provider forgot the key can send twice). CHANGELOG and README say so; the CLI names `--resend-uncertain`. |
| 3 | Warning | Legacy link values are copied into hidden inputs and passed to app code; an unbounded value is an easy way to make every page view and `verify` call expensive. | Accepted: each value at most 512 characters, else the link is invalid before `verify` runs. |
| 4 | Warning | The adopter's old links use `t` like the signed scheme. Detecting the scheme by "both `r` and `t`" would let a crafted URL pick the path. | Accepted as planned: `r` present means signed, whatever else is there; legacy `params` may not include `r` or `status`. Test: a signed link with legacy params never calls `verify`. |
| 5 | Warning | Lifecycle senders (billing reminders, waitlist welcome) also get the new `halted` and `uncertain` outcomes; billing counts any unknown status as `retryLater` and keeps calling a provider that refuses the key. | Accepted: billing stops its loop on `halted` and counts `uncertain` as skipped. Waitlist sends one mail per call and only logs `rejected`; no change needed there. |
| 6 | Suggestion | A 429 without a `name` could be either a rate limit or a quota. | Accepted as planned: treated as `quota_exceeded`, which halts but loses nothing (the delivery stays retryable); a misread rate limit costs one re-run, a misread quota would cost a run of failed calls. |
| 7 | Suggestion | `verify` throwing should not read as "invalid link" (the person would be told the link is broken when the app's database is down). | Accepted as planned: a throw is `failed` on the page and 500 on the one-click route. |

No open findings. Verdict: ready to implement.
