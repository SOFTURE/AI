# Plan: security-alerts-sync

## Phases

1. `scripts/security/alert-issues.mjs`: pure functions that turn an alert of each kind into a normalized alert
   (kind, number, title, severity, location, link, details), find the package label for a path, build the issue
   title and body with the marker `<!-- security-alert: <kind>#<number> -->`, read the marker back, and plan the
   sync (create, reopen, close) from the open alerts, the existing issues and the kinds that were read.
   `scripts/security/sync-alerts.mjs`: reads the alerts and issues through the REST API and applies the plan.
   `.github/workflows/security-alerts.yml`: hourly at :17 and on demand, `issues: write`, `security-events: read`,
   `SECURITY_ALERTS_TOKEN` for the two other kinds. `tests/repo/security-alerts.test.ts`: the body never carries
   the secret, the marker round-trips, re-runs create nothing twice, a fixed alert closes its issue, a kind that was
   not read closes nothing, package labels only when they exist; the workflow's trigger and permissions.
   Gates: typecheck, lint, repository tests.

## Decisions (auto)

- A missing `SECURITY_ALERTS_TOKEN` is a workflow warning, not a failure (owner, 2026-11-05: the token comes the
  next day and the change lands now): code scanning still syncs, the run summary names the secret, and issues of the
  unread kinds stay as they are. A token that is present but refused (401, 403) fails the run with the status and
  the secret's name, since that is a wrong token, not a missing one.
- An open alert whose issue was closed reopens that issue with a comment: the alert is still open, so the work is
  not done; a false positive is settled by dismissing the alert (the owner), which then closes the issue for good.
- The issue keeps the marker in an HTML comment, so a re-run finds it whatever the title says after an edit.
- `pkg: <name>` is set when the path sits in a workspace package folder and the label exists; otherwise the issue
  carries only `security` (resolves the item's open unknown).

## Progress

- [x] p1 e7d84f8: `scripts/security/alert-issues.mjs` and `sync-alerts.mjs`, `.github/workflows/security-alerts.yml`, `tests/repo/security-alerts.test.ts` (23 passed); a run with a refused token prints `::error::... 401 Bad credentials` and exits 1 (local check); typecheck, lint and language green (pre-commit), `tests/repo` 21 files green.
