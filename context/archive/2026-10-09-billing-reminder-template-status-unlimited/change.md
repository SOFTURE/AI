---
change_id: billing-reminder-template-status-unlimited
title: "billing: reminder mail template slot, read-only entitlement-status script, effectively unlimited access in the badge (issue #323)"
status: archived
roadmap_item: null
issue: 323
branch: claude/project-thread-mnpbkg
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close the three points of [issue #323](https://github.com/SOFTURE/AI/issues/323), so an adopting app drops its own
trial-ending mail job, its status shell script and its own badge:

1. `sendAccessReminders` takes the app's template (`buildMail`) and its delivery scopes (`getScope`), so the app
   keeps its mail and its ledger entries while the package selects and delivers;
2. a read-only `entitlement-status` ops script next to `createExtendTrialScript`: state, trial end, paid-until in
   the app's time zone, never the email;
3. `AccessBadge` knows "effectively unlimited" access (`unlimitedAfterDays`), has a compact label (`compact`) and
   takes the app's tones (`tones`); `AccessNotice` takes its tones too. The `/next` wrappers pass them through.

A reviewer checks `tests/reminder-mail.test.ts`, `tests/status-script.test.ts`, `tests/access.test.tsx`, the README
and the CHANGELOG.

## Context

Issue #323, filed by an adopting app. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.
`@softure-ai/billing` 0.1.10 is published, so this is 0.1.11. Mailing 0.1.12 (`runDeliveries`) is on master, unreleased; billing
keeps its own loop over `deliverOnce` (it already stops at `halted`), so no new mailing version is required.

## Constraints

- Defaults render and send exactly as in 0.1.10: every new option is opt-in.
- No migration, no change to `@softure-ai/ops` (issue #328 is changing it in flight).
- Reports and output never print an email.
- English-only code and docs.

## Notes

- Research: skipped as a separate file. The issue names the three gaps; reading `mailing/reminder-mail.ts`,
  `server/reminders.ts`, `scripts/trial-scripts.ts`, `@softure-ai/ops/scripts`, `ui/access-badge.tsx`,
  `ui/access-notice.tsx` and `next/access.tsx` answered every unknown; the findings are in plan.md's "Today".
- Framing: skipped. Observed adoption gaps with the shape the adopter proposed.
