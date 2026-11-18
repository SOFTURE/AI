# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ci-usage` or the reusable
`ci-usage.yml` workflow. When an app has run a version in production, the version gets a line
`verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md), "Definition of done").

## 0.1.0

- First version (#1360). `softure-ci-usage report` reads the finished workflow runs of a period through the Actions
  API (one UTC day at a time, split into hours past GitHub's 1,000-run cap) and writes `ci-usage.json`
  (`schemaVersion: 1`) and `ci-usage.md`: billable minutes (each job rounded up to a whole minute, reruns included)
  and estimated USD per repository, workflow and job, split into GitHub-hosted, Ubicloud and other self-hosted
  runners, with the heaviest and the longest jobs.
- Prices: GitHub's standard runner SKUs and Ubicloud's standard and premium sizes, built in with their source and
  the day they were checked; `--prices` adds or overrides prices by runner label.
- `--billing org:<name>|user:<name>` adds what GitHub billed per repository and SKU from the billing usage API.
- A request budget (`--reserve`) and a cache of finished runs (`--cache`): a busy repository ends in a partial
  report, never a failed or sleeping job.
- `softure-ci-usage publish` keeps one issue labelled `ci-usage` up to date and comments each run's totals.
- The reusable workflow `.github/workflows/ci-usage.yml` and the example caller `examples/ci-usage.yml` (weekly
  schedule and `workflow_dispatch`).
