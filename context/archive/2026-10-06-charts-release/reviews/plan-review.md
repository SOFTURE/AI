# Plan review: charts-release

Reviewed 2026-10-06 against change.md, `release.yml`, `auto-release.yml`, `scripts/release/` and the charts
package on master. Verdict: **approve with two fixes applied**.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The adoption guide can mislead on units: FIRE's `valueTicks(peakCents, target)` works in cents and its `formatAxisAmount` adds the PLN suffix, while charts' `valueTicks` is unit-free with `minStep`. A one-to-one mapping row would hide that. | Fixed in the plan: the guide states the unit and what stays in FIRE (formatter, `capitalOf`, `unlock-step`, surfaces and tones). |
| 2 | Warning | `examples/next-app` installs charts through `file:`; removing `private` might change its lockfile. | Checked: `npm install --package-lock-only` leaves both lockfiles unchanged, and the example app has no charts entry in its lockfile that records `private`. Nothing to do. |
| 3 | Suggestion | `auto-release` with `all` also plans `charts@0.1.0`; without `NPM_TOKEN` charts' npm job fails while every other package releases. | Kept the recommendation `ui charts`, and the owner steps say to add the token first. A failed charts job is safe to re-run (runbook). |
| 4 | Suggestion | Progress has an owner item (1.4) that this change cannot tick. | Accepted: the change archives as `done_code`, like DP-8 and BL-8 did, with the owner step in the roadmap. |

Checked and fine: no other workspace marks charts as private (`plan-tags`, `pack`), the tag `charts@0.1.0` does not
exist yet, the name is free on npm (E404 on 2026-10-06), `@softure-ai/core` `^0.1.0` resolves to 0.1.5 on npm.
