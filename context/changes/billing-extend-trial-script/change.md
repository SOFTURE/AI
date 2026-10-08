---
change_id: billing-extend-trial-script
title: "billing: extend-trial ops script (relative days, dry run) and a lead line under the page headings (issue #243)"
status: plan_reviewed
roadmap_item: null
issue: 243
branch: claude/project-thread-14qhe4
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Close both points of [issue #243](https://github.com/SOFTURE/AI/issues/243), so an app that extends trials and
describes its billing page keeps no code of its own for them:

1. an `extend-trial` ops script in `@softure-ai/billing/scripts` (`createExtendTrialScript`), dry run by default,
   that takes the account by `--email` or `--user` and the new end either as a last day (`--until=YYYY-MM-DD`) or
   relative (`--days=N`, counted from the later of today and the current trial end). It writes through
   `extendTrialManually` with `adminId: null`, so it has the admin form's refusals and its `billing.trial_extensions`
   row;
2. a `lead?: string | null` prop on `BillingAdminPage` and `PaymentPage`, rendered as one paragraph right after the
   `<h1>`.

A reviewer checks `tests/trial-scripts.test.ts`, `tests/pages.test.tsx`, the README "Scripts" and "Page headings"
sections and the CHANGELOG.

## Context

Issue #243, a follow-up to #229 (billing 0.1.8) found while an app adopted 0.1.8. Work is tracked in GitHub Issues:
no roadmap item; the PR closes the issue. Released as billing 0.1.9.

## Constraints

- The script must not duplicate `extendTrialManually`'s rules: refusals and the recorded row come from it.
- Reports and refusals never print an email (like the other billing scripts).
- No migration: `billing.trial_extensions.extended_by` is already nullable (0010).
- `lead` defaults to none, so existing pages render exactly as in 0.1.8.
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. The issue names both gaps and their code paths; reading
  `server/trials.ts`, `scripts/plan-scripts.ts`, `@softure-ai/ops/scripts` (`defineOpsScript`, argument parsing),
  `calendar.ts`, `next/actions.ts` (`extendTrialAction`'s last-day arithmetic) and `next/pages.tsx` answered every
  unknown; the findings are in plan.md's "Today" section.
- Framing: skipped. Both points are observed adoption gaps with the shape the adopter proposed; the open choices
  (what `--until` means, where `--days` counts from) are settled in the plan.
