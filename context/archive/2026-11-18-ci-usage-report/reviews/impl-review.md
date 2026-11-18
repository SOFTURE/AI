# Implementation review: ci-usage-report

Reviewed: commits d8ea0e4..31798dd against plan.md, change.md and the plan review. Mode: autonomous.
Verdict: approve; one finding fixed in the change, the rest accepted with their reason.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A weekly report over a 7-day window never reuses the previous week's run cache (the windows do not overlap), so SOFTURE/AI's ~1,150 weekly runs would exceed one GITHUB_TOKEN hour on every run and always end partial. | Fixed in 31798dd: the own caller runs daily (cache warm, about one day of new runs per run) and publishes on Mondays and by hand; the README shows the pattern for busy repositories. |
| 2 | Warning | No live run against the GitHub API before the merge: the container's token is refused by api.github.com (401), and the workflow installs the CLI from npm, where 0.1.0 is not published yet. | Accepted: the collector is tested on the API's real shapes (run 44312373806, keys missing while it ran), the workflows pass actionlint 1.7.12 and the repository rules; the first live run is the release step's check (below). |
| 3 | Suggestion | A larger GitHub runner (custom label in GitHub's runner group) is priced as Linux 2-core. | Accepted: documented in the README; `prices` names its label. |
| 4 | Suggestion | Ubicloud premium is invisible in a job. | Accepted as planned: the `ubicloud-premium` input, stated in the report's price line. |

Gates: `npm run typecheck` green; ESLint on every changed file (`--max-warnings 0`) green (the whole-tree run ran out
of memory in this container; CI runs it); language gate green; `npm run build` green; `vitest run tools/ci-usage`
75 tests and `vitest run tests/repo` green (1,253 tests, 81 skipped); actionlint on the three workflow files clean.
