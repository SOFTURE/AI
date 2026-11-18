# @softure-ai/ci-usage

How many GitHub Actions minutes a repository used in a period, and which workflows and jobs used them, on
GitHub-hosted and Ubicloud runners alike, with the estimated cost of each. An app calls the reusable workflow every
week and by hand; the report lands in one issue that people and agents read, in the job summary, and as JSON in the
run's artifact. The same CLI runs on a laptop or in an agent session.

- **One source for every runner.** The Actions jobs API: each job's start, end and runner labels. Minutes are billed
  the way GitHub and Ubicloud bill them: each job rounded up to a whole minute, reruns included, queue time free.
  GitHub's per-run "timing" endpoints are closing down and Ubicloud has no usage API, so nothing else covers both.
- **Per repository, workflow and job.** Totals per provider, every workflow with its share, the jobs that use the
  most minutes (count, p50, p95), the ten longest single jobs with links.
- **Estimated USD at list price.** Built-in prices for GitHub's standard runner SKUs and Ubicloud's standard and
  premium sizes, with their source and the day they were checked; `prices` adds runners the table does not know
  (larger GitHub runners, own runners). A public repository pays nothing for standard GitHub runners and a plan's
  included minutes are not subtracted: the estimate measures how resource-hungry the CI is, not the invoice.
- **What GitHub billed, optionally.** `billing: org:<name>` (or `user:<name>`) adds the billed minutes and amounts per
  SKU from GitHub's billing usage API, next to the estimate.
- **Never red for a busy repository.** Runs are listed one UTC day at a time (split into hours past GitHub's
  1,000-run cap), finished runs are cached between reports, and the client stops at a request reserve: a report that
  could not count everything says so (`partial`) and still succeeds.

## Adoption

1. Copy [`examples/ci-usage.yml`](examples/ci-usage.yml) to `.github/workflows/ci-usage.yml` in the app. It runs
   every Monday at 06:30 UTC and by hand (Actions → ci-usage → Run workflow, or `gh workflow run ci-usage.yml`).
2. Nothing else for a report on the app's own repository: the job reads with its `GITHUB_TOKEN` (`actions: read`)
   and writes the issue with it (`issues: write`).
3. Optional, for one report over several repositories or for the billing lookup: a fine-grained personal access
   token with "Actions: read" on those repositories (and organization "Administration: read" or user "Plan: read"
   for billing), saved as the repository secret `CI_USAGE_TOKEN`; then set `repositories` (and `billing`).

The caller grants `contents: read`, `actions: read` and `issues: write`.

### Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `runs-on` | `'"ubuntu-latest"'` | The report's own runner as JSON, one label or an array (`'"ubicloud-standard-2"'`) |
| `repositories` | the calling repository | `owner/name` entries, comma or space separated (others need `CI_USAGE_TOKEN`) |
| `days` | `"7"` | Length of the period, ending now (1 to 31) |
| `prices` | empty | JSON of runner label to USD per minute, over the built-in table |
| `ubicloud-premium` | `false` | Price Ubicloud minutes as premium (an account setting a job does not show) |
| `billing` | empty | `org:<organization>` or `user:<user>`: add what GitHub billed |
| `publish` | `true` | Keep the `ci-usage` issue up to date |
| `cli-version` | the released version | `@softure-ai/ci-usage` version |
| `node-version` | `"22"` | Node.js version |

Secret: `CI_USAGE_TOKEN` (optional). The report always reads with it when it is set and writes the issue with the
job's own `GITHUB_TOKEN`.

## Reading the report

- **The issue** `CI usage report` (label `ci-usage`): its body is always the latest report, with the JSON in a
  collapsed block at the end (or a pointer to the artifact when it is too long); every run adds a comment with its
  period and totals, so the comments are the history. An agent reads it with the GitHub tools it already has (an
  issue read of the label `ci-usage`).
- **The artifact** `ci-usage-report` of the run: `ci-usage.json` and `ci-usage.md`, kept 90 days.
- **The CLI**, anywhere with a token:

  ```bash
  GITHUB_TOKEN=… npx @softure-ai/ci-usage report --repository acme/app --days 7 --out-dir report
  ```

Every minute in the report is a billable minute; `Est. USD` is minutes times the list price of the runner. A
repository whose runs could not all be counted (the rate limit, an hour of more than 1,000 runs, a run whose jobs
could not be read) is listed with the reason under "Notes", and the report says `Status: partial`.

### The JSON (`schemaVersion: 1`)

```text
generatedAt, period { from, to, days }, partial, notes[]
totals { minutes, usd, unpricedMinutes, runs, jobs, byProvider { github-hosted, ubicloud, self-hosted } }
prices { source, checkedOn, ubicloudPremium, labels }
repositories[] {
  repository, minutes, usd, unpricedMinutes, runs, jobs, byProvider, partial[], error, runsRunning, runsFromCache,
  byWorkflow[] { name, path, runs, jobs, minutes, usd, share, byJob[] { name, runner, provider, count, minutes, usd, p50Minutes, p95Minutes } },
  longestJobs[] { workflow, job, runner, minutes, url },
  billing[] { sku, minutes, grossUsd, netUsd } | null
}
```

`usd` is `null` wherever some minutes ran on a runner without a known price (`unpricedMinutes` says how many).

## Runners

| Labels | Provider | Price |
| --- | --- | --- |
| `ubuntu-*`, `ubuntu-*-arm`, `ubuntu-slim`, `windows-*`, `windows-*-arm`, `macos-*` | GitHub-hosted | the SKU's list price |
| a custom label in GitHub's runner group (a larger runner) | GitHub-hosted | Linux 2-core unless `prices` names the label |
| `ubicloud`, `ubicloud-arm`, `ubicloud-standard-<2/4/8/16/30>[-arm][-ubuntu-XXXX]` | Ubicloud | standard (or premium with `ubicloud-premium`) by vCPU |
| anything else | self-hosted | only from `prices`; otherwise counted without a price |

## CLI

```text
softure-ci-usage report [--repository <owner/name>[,…]] [--days 7 | --from <date> --to <date>] [--out-dir .]
                        [--prices <json>] [--ubicloud-premium] [--billing org:<name>|user:<name>]
                        [--cache <file>] [--reserve 50]
softure-ci-usage publish [--repository <owner/name>] [--report-dir .] [--run-url <url>]
```

The token comes from `GITHUB_TOKEN` (or `GH_TOKEN`); the repository defaults to `GITHUB_REPOSITORY`. `report` exits
0 when at least one repository was read (a partial report included) and 1 on an input error or when no repository
could be read. The library exports the same steps (`collectRepository`, `summarizeUsage`, `buildReport`,
`renderMarkdown`, `publishReport`) and the copy as a message dictionary (`ciUsageMessages.en`), which an app can
replace with its own wording of the same shape.
