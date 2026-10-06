/** Copy of the release report, posted on a GitHub Release. */
export const en = {
  releaseNotes: {
    /** Heading of the report; `{to}` is the released tag, `{date}` its commit date (YYYY-MM-DD). */
    heading: "{to} ({date})",
    summary: "Changes since {from}: {pullRequests} pull requests, {commits} other commits.",
    /** A first release: no earlier tag, so the range starts at the first commit. */
    summaryFromStart: "Changes from the first commit: {pullRequests} pull requests, {commits} other commits.",
    empty: "No changes since {from}.",
    pullRequests: "Pull requests",
    commits: "Other commits",
    fullDiff: "Full diff",
    /** The table of roadmap items the release ships (`--roadmap`) and its column titles. */
    roadmapItems: "Roadmap items",
    roadmapId: "ID",
    roadmapChange: "Change",
    roadmapOutcome: "Outcome",
  },
  /** Copy of the deploy run's report in the same release body (`release-report`, DF-10). */
  releaseReport: {
    statusHeading: "Pipeline status",
    job: "Job",
    result: "Result",
    /** Under the status table; `{time}` is the run's end (UTC), `{url}` the run. */
    lastRun: "Run: [{time} UTC]({url})",
    deploymentsHeading: "Deployments",
    when: "When (UTC)",
    outcome: "Result",
    environment: "Environment",
    image: "Image",
    database: "Database",
    verify: "Verify",
    run: "Run",
    runLink: "run",
    deployed: "deployed",
    /** A deploy the server stopped at `{step}` (its `result|failed|<step>|…` line). */
    failedAt: "failed at {step}",
    backup: "backup",
    rows: "rows",
    notCounted: "not counted",
    /** GitHub job results; `pending` stands for any other or missing result. */
    results: {
      success: "success",
      failure: "failure",
      cancelled: "cancelled",
      skipped: "skipped",
      pending: "pending",
    },
  },
};
