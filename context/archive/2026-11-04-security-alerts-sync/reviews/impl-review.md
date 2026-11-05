# Implementation review: security-alerts-sync

Verdict: approved.

- The secret never reaches an issue: `readSecretScanningAlert` copies only the type, validity and location, and the
  test checks the alert, title and body against a secret-shaped value.
- Idempotent: issues are matched by the marker in the body across open and closed issues, so a re-run creates
  nothing; a closed copy never shadows an open issue for the same alert.
- Safe without the secret: the unread kinds are absent from `readKinds`, so none of their issues closes; the run
  warns with the secret's name and exits 0. A refused token fails with the status (checked locally with a bad token).
- Pull requests in the issue list are skipped; `pkg:` labels are added only when they exist, since creating an issue
  with an unknown label would create it.
- Workflow: hourly at :17 and on demand with a dry run, `issues: write`, `security-events: read`, one run at a time,
  a sparse checkout of the scripts only and a 10-minute timeout.
- Gates: typecheck, lint and language green; `tests/repo` green.
