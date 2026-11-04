---
change_id: security-alerts-sync
title: "Open security alerts become GitHub issues, so the hourly issue check picks them up"
status: backlog
roadmap_item: LT-5
branch: null
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Intent

Every open alert in the Security tab (code scanning, Dependabot, secret scanning) shows up as a GitHub issue
within an hour, so the coordinator's hourly issue check picks it up like any other report, and the issue closes
when the alert is fixed or dismissed.

## Context

From [`roadmap-later.md`](../../../foundation/roadmaps/roadmap-later.md), item **LT-5** (owner, 2026-11-04): the
agent sessions cannot read the Security tab. Their GitHub tools have no access to code scanning, Dependabot or
secret scanning alerts (checked 2026-11-04), so alerts are only seen when the owner opens the tab. The sessions do
read issues, and the coordinator checks new issues every hour, so turning alerts into issues closes the gap
without new access for the sessions.

The workflow's own `GITHUB_TOKEN` can read code scanning alerts (`security-events: read`) but not Dependabot or
secret scanning alerts, which need a token with those permissions.

## Scope

- `.github/workflows/security-alerts.yml`: on a schedule (hourly) and on demand, list the open alerts of the
  three kinds and, for each, open one issue labelled `security` plus the matching `pkg: <name>` when the alert's
  path belongs to a package. One alert = one issue, found again by a marker in the body (kind and alert number),
  so a re-run never duplicates. An alert that is fixed or dismissed closes its issue with a comment.
- Issue text: the kind, severity, rule or advisory, the file and line or the dependency and fixed version, and a
  link to the alert. A secret scanning issue names the secret type and location only, never the secret.
- Permissions: `issues: write` and `security-events: read` from `GITHUB_TOKEN`; Dependabot and secret scanning read
  through the repository secret below.
- A repository test for the issue body and the matching logic (no network).

## Prerequisites

- **LT-4** on the main branch (Dependabot alerts turned on), so there are Dependabot alerts to read.
- The owner at the keyboard: create a fine-grained personal access token for SOFTURE/AI with read access to
  **Dependabot alerts** and **Secret scanning alerts** (and Code scanning alerts), and save it as the repository
  secret `SECURITY_ALERTS_TOKEN`.

## Constraints

- Read-only towards the alerts: the workflow never dismisses an alert; a session that decides an alert is a false
  positive says so in the issue and the owner dismisses it.
- A missing `SECURITY_ALERTS_TOKEN` fails the run with a clear message naming the secret, and code scanning alerts
  still sync.
