# Plan review: deploy-release-report

Reviewed: plan.md against change.md, research.md, `deploy-app.yml`, DF-9's `deploy.sh.tmpl` and send step (PR #132),
`tests/repo/deploy-workflows.test.ts`, FIRE's `release.yml` report job and lessons. Mode: autonomous (`--auto`),
every finding decided by the reviewer.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Critical | `deploy-report.yml`'s `concurrency` group per tag would make two e2e runs of different pull requests on different SHAs fine, but a manual re-run of the e2e on one SHA would queue behind itself only once and cancel a pending one: GitHub keeps one pending run per group. | Accepted: under e2e the group gets `-e2e-<run id>`, as the deploy job's does (DF-3 P1). |
| P2 | Warning | The step that keeps `server-lines` must run after a failed send and when the output file was never written (the send step did not start). | Accepted: `if: always()`, `grep … 2> /dev/null \|\| true`; the cleanup removes the file. |
| P3 | Warning | When `row-counts --compare` fails (rows lost) there is no `row-counts-after` line; the row must still show the counts before. | Accepted: the Database cell writes `users 3 → ?` for a table with no count after. |
| P4 | Warning | `gh` needs a token and a repository with no checkout. | Accepted: `GH_TOKEN: ${{ github.token }}` on the two `gh` steps only, `--repo "$GITHUB_REPOSITORY"`. |
| P5 | Warning | The repository test asserts `packages: write` on the `build` job of every `deploy-*.yml`; `deploy-report.yml` has no build job. | Accepted: the "only build" rule becomes "no job but build", and a new rule pins `contents: write` to `deploy-report.yml`'s one job. |
| P6 | Suggestion | A release body is limited to 125 000 characters; with hundreds of reruns the history would hit it and `gh release edit` would fail. | No change: one row is about 300 characters, so the limit is past 300 runs on one tag; the failure is visible in the report job and does not affect the deploy. Recorded in the README. |
| P7 | Suggestion | `continue-on-error` on a job of a called workflow: the caller's job then reads as success, which hides a broken report in production. | No change: intended (change.md constraint); the report job's log and the run's annotations still show it. |

No open blocking findings. Plan updated (P1 to P5).
