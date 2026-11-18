/** Copy of the CI usage report (Markdown, the issue and its comments). English, the only built-in language. */
export const en = {
  title: "CI usage report",
  /** `{from}` and `{to}` are UTC times, `{days}` the length of the period. */
  period: "Period: {from} to {to} UTC ({days} days). Generated {generated} UTC.",
  complete: "Status: complete.",
  partial: "Status: partial, some runs are not counted (see the notes of each repository).",
  howToRead:
    "Minutes are billable minutes: each job rounded up to a whole minute, reruns included. USD is the estimate at list price (public repositories pay nothing for standard GitHub runners; the plan's included minutes are not subtracted).",
  totalsHeading: "Totals",
  repository: "Repository",
  minutes: "Minutes",
  usd: "Est. USD",
  githubHosted: "GitHub-hosted",
  ubicloud: "Ubicloud",
  selfHosted: "Self-hosted",
  runs: "Runs",
  jobs: "Jobs",
  workflowsHeading: "Workflows",
  workflow: "Workflow",
  share: "Share",
  topJobsHeading: "Jobs that use the most minutes",
  job: "Job",
  runner: "Runner",
  count: "Count",
  p50: "p50 min",
  p95: "p95 min",
  longestHeading: "Longest single jobs",
  /** One list item; `{url}` links the job. */
  longestItem: "[{minutes} min]({url}) {workflow} / {job} on `{runner}`",
  billingHeading: "Billed by GitHub",
  sku: "SKU",
  gross: "Gross USD",
  net: "Net USD",
  notesHeading: "Notes",
  /** Runs still running when the report was made: counted next time. */
  running: "{count} runs were still running and are left out.",
  fromCache: "{count} of {total} runs came from the cache of earlier reports.",
  unknownPrice: "{minutes} minutes ran on runners without a known price (set the `prices` input to price them).",
  error: "Not read: {error}",
  noRuns: "No finished runs in the period.",
  unknown: "unknown",
  /** Under the report; `{source}` lists the price pages, `{checkedOn}` the day they were read. */
  prices: "Prices: {source} (checked {checkedOn}){premium}.",
  premium: ", Ubicloud priced as premium",
  jsonSummary: "The report as JSON",
  jsonTooLong: "The JSON report is too long for this issue: it is in the run's artifact `ci-usage-report`.",
  issueIntro:
    "This issue is kept up to date by the ci-usage workflow (@softure-ai/ci-usage): its body is always the latest report, and every run adds a comment with its totals.",
  /** The comment one run adds; `{url}` is the run. */
  comment: "{from} to {to} UTC: {minutes} minutes, {usd} USD estimated, {runs} runs. [Run]({url})",
} as const;
