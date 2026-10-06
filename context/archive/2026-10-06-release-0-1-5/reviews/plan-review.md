# Plan review: release-0-1-5

Date: 2026-10-06 · Verdict: approved

- npm trusted publishing needs npm >= 11.5.1; the job installs npm 11 and checks it.
- A publisher without "Allow npm publish" makes the job fail (E403) before GitHub Packages and the GitHub Release,
  so a refusal publishes nothing; the runbook says to correct the publisher and re-run the job.
- The already-released check (`npm view name@version`) now sees every earlier publish, so re-runs stay idempotent.
