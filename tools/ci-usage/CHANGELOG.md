# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ci-usage` or the reusable
`ci-usage.yml` workflow. When an app has run a version in production, the version gets a line
`verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md), "Definition of done").

## 0.1.3

- `publish --close` (the workflow input `close-issue`, default `false`) keeps the report's issue closed: the issue is
  found open or closed by its label and marker, updated and commented as before, and closed as completed after
  every run (a new issue is closed after its first comment). A repository that has acted on its report no longer
  keeps an open issue in its queue, and the report is still read through the label `ci-usage`.

## 0.1.2

- GitHub's dynamic workflows (CodeQL default setup, Dependabot updates, Copilot, Pages) are reported under one
  stable name from their path (#1369), not under the title of whichever run came first ("PR #1240"). Other
  `dynamic/...` workflows are named by their path. The cached runs need no rebuild: the name is set when the report
  is built. `getWorkflowName` is exported.

## 0.1.1

- A busy repository's report ends inside the job time (#1366): the jobs of eight runs are read at a time, and
  `--max-minutes` (the workflow input `max-minutes`, default 10, below the 15-minute job timeout) stops reading and
  marks the repository partial ("stopped at the time budget"), so the artifact, the issue and the run cache are saved
  and the next run goes further. 0.1.0 was cancelled at the timeout on a cold cache with nothing published.
- The first version published through the npm trusted publisher (OIDC) with provenance; the reusable workflow
  installs 0.1.1 by default (`cli-version`).

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
