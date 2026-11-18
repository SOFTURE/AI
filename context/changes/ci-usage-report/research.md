# Research: ci-usage-report

Input: change.md, the owner's request (2026-11-18), GitHub and Ubicloud documentation, live API responses from
SOFTURE/AI. Depth: normal (read-only reporting, no money moves, no data migration).
Snapshot: c2f1316 on master, 2026-11-18 14:30 Europe/Warsaw.

## Summary

- **One data source covers both providers and the per-workflow, per-job breakdown:** the Actions jobs API
  (`GET /repos/{owner}/{repo}/actions/runs?created=…` then `GET …/runs/{run_id}/jobs?filter=all`). Every job carries
  `started_at`, `completed_at`, `labels`, `runner_name`, `runner_group_name`, `workflow_name` and `run_attempt`, which
  is enough to compute billable minutes (each job rounded up to a whole minute, as both GitHub and Ubicloud bill) and
  to tell a GitHub-hosted job from an Ubicloud one (labels `ubicloud*`). It works with the caller's `GITHUB_TOKEN`
  (`actions: read`), no extra secret, for the repository the workflow runs in.
- **GitHub's billing usage API** (`/organizations/{org}/settings/billing/usage`, `/users/{username}/…`) gives the
  billed minutes and amounts per repository and SKU, but no workflow or job detail, and needs a fine-grained token
  with organization "Administration: read" or user "Plan: read". It is an optional reconciliation line, not the core.
- **The per-run "timing" endpoints are closing down** (GitHub changelog 2025-02-02); they must not be the base.
- **Ubicloud has no usage or billing API** (its API covers projects, firewalls, VMs, Postgres, GitHub installations,
  repositories and cache entries). Ubicloud cost is therefore estimated from the jobs API and Ubicloud's published
  per-minute prices; the monthly invoice in the Ubicloud console stays the authority.
- **Recommendation: a new tool package `@softure-ai/ci-usage`** (CLI `softure-ci-usage` + reusable workflow
  `ci-usage.yml`), shaped like `@softure-ai/quality-review`. No existing package fits by purpose; details and the
  alternatives under "Open questions". This is the owner's decision.
- **Agent access** without new infrastructure: the run writes JSON + Markdown as an artifact and the job summary, and
  keeps one rolling issue (label `ci-usage`) per repository up to date, which every agent session reads through the
  GitHub tools it already has; the same CLI runs locally (`npx @softure-ai/ci-usage report --json`).

## Current state

- No CI-usage reporting exists in SOFTURE/AI (`grep -ri "billing/usage\|ci-usage"` over the tree: nothing).
- SOFTURE/AI's own workflows run on `ubuntu-latest` (23 jobs) or on the caller's `runs-on` input (18 jobs in the
  reusable deploy and quality-review workflows); one job on `macos-latest` (`.github/workflows/macos.yml`). No
  Ubicloud label in this repository; adopting apps pass Ubicloud labels through the `runs-on` inputs
  (`deploy-app.yml`, `deploy-report.yml`, `quality-review.yml` all accept `runs-on` as JSON).
- Volume measured live: SOFTURE/AI has 10,536 workflow runs in total; run #1,000 counted from the newest was created
  on 2026-11-12 11:39 UTC, so about **1,150 runs a week** in this repository alone.
- A live jobs response (run 44312373806, `release`): `labels: ["ubuntu-latest"]`, `runner_name: "GitHub Actions
  1000040131"`, `runner_group_name: "GitHub Actions"`, per-step timestamps. The run-usage endpoint still answers here
  (`billable.UBUNTU.total_ms: 0`, a public repository's free minutes), but it is announced as closing down.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| New package (recommended) | `tools/ci-usage/**` (from `templates/package/`) | collector, pricing, report rendering, CLI |
| Reusable workflow | `.github/workflows/ci-usage.yml` | what an app calls (schedule + workflow_dispatch in the caller) |
| Example caller | `tools/ci-usage/examples/ci-usage.yml` | the few lines an app copies |
| Own use | `.github/workflows/ci-usage-self.yml` (or a caller job) | SOFTURE/AI reports on itself, which is also the e2e |
| Repository tests | `tests/repo/release-tags.test.ts` (public package count), workflow default `cli-version` = package version (the rule quality-review already has) | package shape and release rules |
| Labels | `pkg: ci-usage` | issue convention |

## Data

No database. The report's shape (JSON, versioned `schemaVersion: 1`):

- `period` (`from`, `to`, ISO), `generatedAt`, `repositories[]`, `partial` (with the reasons: rate limit reached,
  billing API refused, runs still in progress), `prices` (the table used, with its `source` and `checkedOn`).
- Per repository: totals by provider (`github-hosted`, `ubicloud`, `self-hosted-other`), minutes and estimated USD;
  per workflow (path and name): runs, jobs, minutes, USD, share of the repository total; per job name inside a
  workflow: count, minutes, p50/p95 duration, the runner label; the ten longest single jobs with links.
- Optional `billing` block per repository from GitHub's billing usage API: `sku`, `quantity` (minutes), `netAmount`,
  so the estimate and GitHub's own number sit side by side.

Computation rules (from the providers' documentation):

- Job minutes = `ceil((completed_at - started_at) / 60 s)` per job, per attempt (`filter=all` counts reruns: they
  are billed too). Queue time before `started_at` is not billed. Skipped jobs (no `started_at`) count 0.
- GitHub-hosted price per minute by SKU (docs, "Actions runner pricing", 2026 rates): `actions_linux_slim` $0.002,
  `actions_linux` $0.006, `actions_linux_arm` $0.005, `actions_windows` $0.010, `actions_windows_arm` $0.010,
  `actions_macos` $0.062. Public repositories pay nothing for standard runners; private ones draw from the plan's
  included minutes first. The report shows list cost ("what it would cost"), which is the resource measure the owner
  asked for, and the billing block shows what was actually charged.
- Ubicloud per minute (docs, "Pricing"): standard x64 and arm64 $0.00125 / $0.0025 / $0.005 / $0.010 / $0.01875 for
  2 / 4 / 8 / 16 / 30 vCPU; premium $0.002 per 2 vCPU (scaled the same way); $2.50 monthly free credit. The vCPU count
  comes from the label (`ubicloud-standard-{n}[-arm][-ubuntu-XXXX]`, `ubicloud` = 2 vCPU x64, `ubicloud-arm` = 2 vCPU
  arm64).
- Larger GitHub runners and other self-hosted labels: priced from a caller-supplied table (input `prices`, JSON
  merged over the built-in one); unknown labels are reported with minutes and `usd: null`, never guessed.

## Tests

- Unit (Vitest, fixtures of real API responses with identifiers stripped): minute rounding, reruns, skipped jobs,
  label → provider/SKU/vCPU mapping, price overrides, partial-report marking, rendering (snapshot of the Markdown).
- An HTTP fake for pagination and rate-limit headers (`x-ratelimit-remaining`, `retry-after`), like the fake Stripe in
  the example e2e; no test talks to GitHub or Ubicloud.
- Repository tests: package shape, release count, workflow `cli-version` default equals the package version.
- Evidence the run can produce itself: `workflow_dispatch` of the SOFTURE/AI caller on the branch, its artifact and
  issue checked against a hand count of one day.

## Patterns to follow

- `tools/quality-review` + `.github/workflows/quality-review.yml`: a CLI published to npm and a reusable workflow that
  installs it at an exact `cli-version`, validates `runs-on` as JSON, writes an artifact, and has a separate
  least-privilege delivery step.
- `.github/workflows/security-alerts.yml` + `scripts/security/alert-issues.mjs`: a scheduled job that keeps issues in
  sync idempotently (one issue per key, updated in place, closed when obsolete) and degrades without its optional
  token ("Without it the run warns and syncs code scanning only").
- `.github/workflows/deploy-report.yml`: `continue-on-error` for a report that must never turn a run red.
- Message dictionary for user-facing copy (`messages/en.ts`), English only.

## Prior work

- `context/archive/*ci*` and PRs #1043, #1046 (2026-11-04): the CI optimisation the owner prioritised; this report is
  the measurement that tells which of those jobs still dominate.
- `tools/quality-review` 0.1.0–0.3.0 (#1212, #1289): the reusable-workflow-plus-CLI shape, its release rule
  (`cli-version` bumped with the package).

## SOFTURE modules

- `@softure-ai/metering`: not applicable. It is an app runtime ledger in Postgres for paid provider calls made by the
  app's own code, with budgets that refuse a call; CI minutes are spent outside the app, by GitHub and Ubicloud.
- `@softure-ai/observability`, `@softure-ai/ops`: not applicable; app runtime (logger and OTLP; health endpoint).
- `@softure-ai/deploy`, `@softure-ai/quality-review`: the closest neighbours by delivery shape, not by purpose (see
  "Open questions").

## Risks

- **Rate limit (likely in busy repositories).** `GITHUB_TOKEN` allows 1,000 REST requests an hour per repository;
  a week of SOFTURE/AI is about 1,150 runs, one jobs request each, plus pagination. Mitigation: skip runs whose
  `conclusion` is `skipped` and runs with no started job; keep a cache of finished runs (`actions/cache`, keyed by
  repository) so each run fetches only new runs; allow an optional `CI_USAGE_TOKEN` (fine-grained, "Actions: read",
  5,000 an hour) and a daily schedule for collection with the weekly report built from the cache. When the budget runs
  out the report says `partial` with the covered window, it never fails.
- **Price drift (certain over time).** GitHub cut hosted prices on 2026-01-01 and proposed, then postponed, a $0.002
  per minute charge for self-hosted runners (which would include Ubicloud). Mitigation: the price table carries
  `source` and `checkedOn`, the caller can override it, and a self-hosted platform fee is a table entry (0 today).
- **Ubicloud premium runners are not visible in the job** (premium is an account setting with fallback to standard;
  the label is the same). Mitigation: price as standard by default, an input `ubicloud-premium: true` prices as
  premium; the report states which was assumed. Checked at implementation on a real Ubicloud job's `runner_name`.
- **Cross-repository view needs a token only the owner can create.** The per-repository report needs nothing; a hub
  run over several repositories needs `CI_USAGE_TOKEN` with "Actions: read" on those repositories, and the billing
  reconciliation needs "Administration: read" (organization) or "Plan: read" (user). Owner step, documented, optional.
- **The report costs minutes itself.** One job, no matrix, `timeout-minutes: 10`; reported in its own table.

## Relevant lessons

- L-001 (tsc builds, not bundlers): the CLI is built with tsc like every package.

## Answers to unknowns

- *Can GitHub tell minutes per workflow?* Not through the billing API (per repository and SKU only); yes through the
  jobs API, computed per job with GitHub's own rounding rule.
- *Can Ubicloud tell minutes through an API?* No documented endpoint for usage, invoices or runner history
  (API reference: projects, firewalls, location resources, GitHub installations, repositories, cache entries). The
  jobs API is the only automatable source.
- *Weekly and on demand?* The caller declares `schedule` (e.g. Monday 06:00 UTC) and `workflow_dispatch` with
  `period-days` and `repositories` inputs; the reusable workflow does the rest.
- *How does an agent read it?* The rolling issue `CI usage: <owner/repo>` (label `ci-usage`, body = the Markdown
  report with the JSON in a collapsed block), the run artifact `ci-usage-report` (JSON + MD), and the CLI. A dedicated
  MCP server is not needed: agents already have GitHub tools, and a server would need hosting and a token of its own.

## Open questions

- **Escalated to the owner: where does the code live?** Options, recommended first:
  1. **New package `@softure-ai/ci-usage`** in `tools/` (recommended). One purpose (measure CI cost across
     providers), usable by every repository including libraries and SOFTURE/AI itself, no dependency on a deploy
     setup or an API key, versioned and bumped on its own like quality-review. Cost: one more package and a first
     publication through `NPM_TOKEN`, then the owner sets its trusted publisher.
  2. **A `ci-usage` command and workflow inside `@softure-ai/deploy`.** Apps already pin `deploy-cli-version` and call
     deploy's workflows, so adoption is one more caller job. But deploy is the one-VPS deploy tool; repositories
     without a deploy (SOFTURE/AI, SKILLS, libraries) would install a deploy CLI to count minutes, and every report fix
     would ride deploy's heavier release and e2e path.
  3. **Inside `@softure-ai/quality-review`.** Same "on-demand repository report" shape, but that package is a Claude
     Agent SDK review with an API key and a cost cap; a deterministic API report does not belong behind it.
  4. **A workflow and script in SOFTURE/AI only (no package),** like `security-alerts.yml`. Cheapest to build, but an
     app cannot pin a version to bump, and an agent cannot run it locally.
- Decided (auto, research): the jobs API is the base, the billing API an optional reconciliation, Ubicloud priced
  from its published table; reasons above.

## Decisions (auto)

- Depth normal: read-only reporting; no money is moved, no data migrated.
- The report measures list cost (resource intensity) for every job, public repositories included, because the owner
  asked "how resource-hungry", not "what was invoiced"; the billed amount comes from the billing block when a token
  allows it.
- Reruns count (`filter=all`): they consume minutes.
- Delivery to agents through a rolling issue + artifact + CLI; no MCP server.
- Planning stops here until the owner picks the option above (coordinator's brief: a new package is the owner's call).

Sources: [GitHub billing usage API](https://docs.github.com/en/rest/billing/usage),
[timing endpoints closing down](https://github.blog/changelog/2025-02-02-actions-get-workflow-usage-and-get-workflow-run-usage-endpoints-closing-down),
[Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing),
[Ubicloud pricing](https://ubicloud.com/docs/about/pricing),
[Ubicloud runner types](https://www.ubicloud.com/docs/github-actions-integration/runner-types),
[Ubicloud API overview](https://ubicloud.com/docs/api-reference/overview),
[self-hosted runner charge postponed](https://www.techzine.eu/news/devops/137396/github-bends-to-criticism-and-delays-paid-self-hosting-of-runners/).
