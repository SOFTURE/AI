---
change_id: mailing-campaign-run-limit
reviewed: plan.md
date: 2026-10-08
verdict: approved with fixes applied
---

# Plan review: mailing-campaign-run-limit

Checked `plan.md` against `change.md`, issue #238, `sendCampaign`, `planCampaign`, `deliverOnce`'s outcomes
(`modules/mailing/src/server/deliveries.ts`) and the CLI's campaign path (`src/cli/run.ts`).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `remaining` adds a required field to `CampaignSummary`: tests that compare the whole summary (`campaigns.test.ts`, `import.test.ts`) and any app code that builds one by hand stop matching. | Accepted: the field is required so callers can rely on it; the existing tests gain `remaining`, and the CHANGELOG names the new field. |
| 2 | Warning | The issue says the limit counts recipients "not already done, not suppressed, not in flight". A suppressed recipient is rejected (`mailing.suppressed`) without a send; the plan must not count every rejection. | Accepted: the plan counts `reachedProvider` only (sent, `retry-later`, `mailing.rejected`, `mailing.unavailable`); a test puts an unsubscribed recipient before the cut and checks it does not use a slot. |
| 3 | Suggestion | Counting `remaining` checks suppression once per recipient past the cut, like `planCampaign`; a very long list costs one query per address. | No change: the same cost the dry run already has, paid only when the limit cuts the run. Noted in the README. |
| 4 | Suggestion | A recipient claimed by another live run is counted in `remaining` (it is not closed and not uncertain), as `planCampaign` counts it in `toSend`. | As designed: one definition of "would be sent" is the point of the shared helper; the next run reports it as in flight if the other run still holds it. |
| 5 | Suggestion | `limit` with `retakeUncertain`: a retaken uncertain recipient is sent again and must use a slot. | Covered: it reaches the provider, so `reachedProvider` counts it. |

No finding blocks the plan.
