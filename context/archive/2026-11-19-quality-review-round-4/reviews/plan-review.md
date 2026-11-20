# Plan review: quality-review-round-4

- Checked: `lookupIntegration` has one caller (the `lookup` command); `toLookup` no longer fetches, so `run` and
  `lookup` fetch the main branch themselves before it. OK.
- Checked: `runCli` is the only entry of `main.ts`; a `CliFailure` keeps its own message and exit code. OK.
- Checked: skipping a heartbeat while one is in flight cannot lose a lease that a slow but answering database
  extends, since the next tick sends again once it answered. OK.
- Verdict: approve.
