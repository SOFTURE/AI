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
  },
};
