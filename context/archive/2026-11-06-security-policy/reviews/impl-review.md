# Implementation review: security-policy

Verdict: approved.

- No version number that goes stale: support is stated per minor line, with `npm view` for the current one.
- The report channel is private only; the policy says private reports never become issues, and the alert sync reads
  no advisories, which matches `scripts/security/sync-alerts.mjs`.
- Claims match the repository: provenance (`release.yml` publishes with `--provenance`), grouped Dependabot security
  updates, the hourly sync at :17 that closes issues when alerts close.
- Every relative link resolves (links test green). English only.
