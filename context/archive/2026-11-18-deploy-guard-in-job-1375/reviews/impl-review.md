# Implementation review: deploy-guard-in-job (#1375)

Verdict: approve.

- Default path: every changed condition reduces to the old one with `guard-in-job: false` (`prepare`: `tag != '' ||
  (unit && shards != 1)`; `check`: always; `build`: `success() && inputs.build`, its only need being `check`); the
  shared guard steps skip in the work jobs; every `||` fallback reads a step output that is empty there.
- Folded path: the work jobs run the guard steps deep-equal to the guard job's (tested), before the app's checkout,
  and empty the workspace in between, so the partial clone never meets the real checkout.
- `deploy: true` with the input fails at input validation in the check job, which still runs (tested).
- actionlint accepts `github.job` in the shared conditions; no job references a `needs` it lacks.
- Gap left as is: the release-tag guard now runs once per unit shard under `guard-in-job` with several shards (prepare
  runs too); seconds per shard, no extra billed job.
