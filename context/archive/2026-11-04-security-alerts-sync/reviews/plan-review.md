# Plan review: security-alerts-sync

Verdict: approved.

- Scope matches `change.md`: three kinds, one issue per alert found by a marker, closing on fix or dismissal, a
  secret never in the text, `GITHUB_TOKEN` for issues and code scanning, the secret for the rest, a test without
  network.
- The missing-secret rule departs from `change.md`'s "fails the run": the owner's word of 2026-11-05 (land now, token
  tomorrow) wins; a refused token still fails, so a wrong secret is not hidden.
- Safety: the sync never closes an issue of a kind it could not read, so a missing token cannot close every
  Dependabot issue; the workflow is read-only towards alerts.
