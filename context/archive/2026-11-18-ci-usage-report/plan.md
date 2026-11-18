# Plan: ci-usage-report

Input: [change.md](change.md), [research.md](research.md), issue #1360. Owner decision (2026-11-18, decision card):
a new package `@softure-ai/ci-usage`.

## Approach

A new tool package `tools/ci-usage` (`@softure-ai/ci-usage` 0.1.0, bin `softure-ci-usage`), shaped like
`tools/quality-review`: a pure core (classify a job's runner, bill its minutes, price it, aggregate), a small GitHub
REST client on the built-in `fetch` (pagination, a request budget read from the rate-limit headers, an optional cache
of finished runs), a renderer (JSON `schemaVersion: 1` and Markdown from a message dictionary), and a CLI with two
commands: `report` (collect and write the files) and `publish` (keep one rolling issue up to date and add a short
comment per run). A reusable workflow `.github/workflows/ci-usage.yml` runs both in one job; an example caller adds
the weekly schedule and `workflow_dispatch`; SOFTURE/AI calls it for itself.

## Key decisions

- **Jobs API as the base** (research): minutes = `ceil((completed_at - started_at) / 60 s)` per job and attempt,
  `filter=all`; skipped and unstarted jobs count 0; a started job without `completed_at` in a finished run is billed up to the
  run's `updated_at` (plan review #5); runs still in progress are left out and counted in `partial`.
- **Classification by labels**: a label starting `ubicloud` → Ubicloud (vCPU from `-standard-N`/`-premium-N`, default
  2; `-arm` → arm64); `runner_group_name == "GitHub Actions"` or a GitHub image label (`ubuntu-*`, `windows-*`,
  `macos-*`) → GitHub-hosted with its SKU (`actions_linux`, `actions_linux_arm`, `actions_linux_slim`,
  `actions_windows`, `actions_macos`); anything else → `self-hosted`. An explicit caller price entry for a label wins.
- **Prices**: a built-in table with `source` and `checkedOn` (2026-11-18), overridable by `--prices <json>`
  (label → USD per minute). Unknown label → `usd: null`. Ubicloud premium only by `--ubicloud-premium`.
- **Request budget**: stop collecting when `x-ratelimit-remaining` drops to the reserve (50) and mark the report
  `partial` with the last covered run time; never sleep (a sleep burns the caller's minutes). The workflow restores a
  cache file of finished runs (`actions/cache`), so a repeated run fetches only new runs.
- **Day slices**: the runs list caps a filtered query at 1,000 results, so the collector lists runs one UTC day at a
  time and splits a day into hours when its `total_count` is above 1,000 (plan review #1).
- **Billing reconciliation** is optional: `--billing org:<name>` or `--billing user:<name>`; a refused call (403/404)
  is a `partial` reason, never a failure.
- **Delivery**: one issue per calling repository, title `CI usage report`, label `ci-usage`, body replaced by the
  latest report (Markdown plus the JSON in a collapsed block when it fits the 65,536-character limit), and one comment
  per run with the totals line, so the history stays readable. Agents read the issue with their GitHub tools.
- **Workflow permissions**: `actions: read`, `issues: write`, `contents: read`. `report` reads with
  `secrets.CI_USAGE_TOKEN` when set (cross-repository and billing), else `github.token`; `publish` always writes with
  `github.token` (plan review #2). No checkout: the job installs the CLI at `cli-version` and
  reads nothing from the caller's tree.
- Version 0.1.0 unpublished in this change; the coordinator releases it (first publication through `NPM_TOKEN`, then
  the owner sets the trusted publisher).

## Phases

### Phase 1: the package and its pure core (TDD)

- Files: `tools/ci-usage/{package.json,tsconfig.json,tsconfig.build.json,README.md,CHANGELOG.md}`,
  `src/runner.ts` (classify), `src/prices.ts` (table, override parsing), `src/usage.ts` (job minutes, aggregation),
  `tests/runner.test.ts`, `tests/usage.test.ts`.
- Contract: `classifyRunner({ labels, runnerGroupName, runnerName }) → RunnerClass` (a discriminated union by
  `provider`); `getJobMinutes(job) → number`; `priceMinutes(runner, minutes, prices) → number | null`;
  `summarizeUsage(jobs, options) → RepositoryUsage`.
- Done when: unit tests cover rounding (0 s, 1 s, 60 s, 61 s), reruns, skipped jobs, each label family, overrides,
  unknown labels; typecheck and lint pass.

### Phase 2: the GitHub client (TDD with a fake fetch)

- Files: `src/github.ts` (request, pagination via `Link`, budget), `src/collect.ts` (runs of a period, jobs per run,
  cache), `src/billing.ts`, tests with a fake `fetch`.
- Contract: `collectRepository({ repository, from, to, token, fetch, cache, reserve }) → CollectResult` with
  `jobs`, `partial` reasons, `requests`; `getBillingUsage({ account, from, to, … }) → BillingResult` (result type).
- Done when: tests cover pagination, the budget stop, a cache hit, a 403 on billing, an in-progress run, an API error
  naming the request; no test reaches the network.

### Phase 3: report, CLI and issue delivery

- Files: `src/report.ts` (JSON + Markdown), `src/messages/{en.ts,index.ts}`, `src/publish.ts` (find or create the
  issue and the label, replace the body, add the comment), `src/cli/{main.ts,command.ts}`, `src/index.ts`, tests.
- Contract: `softure-ci-usage report --repository <owner/name>[,…] [--days 7 | --from --to] [--out-dir dir]
  [--prices json] [--ubicloud-premium] [--billing org:x|user:x] [--cache file]` writes `ci-usage.json` and
  `ci-usage.md`; `softure-ci-usage publish --repository <owner/name> --report <dir>`. Token from `GITHUB_TOKEN`
  (or `GH_TOKEN`). Exit 0 on a partial report, 1 on a usage error or a failed API call for every repository.
- Done when: snapshot of the Markdown for a fixture, the JSON shape test, publish tests (create, update, body over the
  limit) with a fake fetch, command tests for argument errors.

### Phase 4: reusable workflow, example, own use, docs and repository rules

- Files: `.github/workflows/ci-usage.yml`, `tools/ci-usage/examples/ci-usage.yml`, `.github/workflows/ci-usage-self.yml`
  (SOFTURE/AI's own weekly report), `tests/repo/ci-usage-workflow.test.ts`, `tests/repo/release-tags.test.ts`
  (count 37 → 38), `tests/repo/workflow-runners.test.ts` if a list needs the new workflow, root README package list.
- Done when: the workflow passes the shared runner rules (runs-on input, runner check, no checkout), `cli-version`
  default equals the package version (test), actionlint in CI is green, `npm run build` builds the package, and a
  local run of the built CLI against SOFTURE/AI for one day writes both files (command and totals recorded below).

## Progress

- [x] Phase 1: the package and its pure core (d8ea0e4; `vitest run tools/ci-usage`: runner, prices, usage tests green)
- [x] Phase 2: the GitHub client (213323a; collect and billing tests with a fake fetch, no network)
- [x] Phase 3: report, CLI and issue delivery (15a9b0c; report, publish and command tests, 74 in the package)
- [x] Phase 4: reusable workflow, example, own use, docs and repository rules (835bf40; tests/repo green, actionlint
  1.7.12 clean on ci-usage.yml, ci-usage-self.yml and the example; `npm run build` green). The local run against
  SOFTURE/AI was refused by api.github.com (401: the container's token is not a GitHub token); replaced by a test on
  the API's real shapes (run 44312373806) and the first live run after the release (impl review #2).
- [x] Impl review fix: daily cache-warming run for the own caller (31798dd)

## Decisions (auto)

- One job with the CLI doing the API calls itself (no `gh`), so the workflow needs no GitHub CLI setup step.
- A comment per run keeps the history; the body always holds the latest report.
- The self-report in SOFTURE/AI runs Mondays 06:30 UTC (after the macOS weekly at 06:00) and on demand, never on
  push or pull request, so it first runs after the release (plan review #3).
