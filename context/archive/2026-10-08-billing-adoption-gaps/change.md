---
change_id: billing-adoption-gaps
title: "billing + mailing: trial extension in the admin page, exact import, page headings, per-mail Reply-To, foreign key indexes (issue #229)"
status: archived
roadmap_item: null
issue: 229
branch: claude/project-thread-fo0doy
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #229](https://github.com/SOFTURE/AI/issues/229) (four in the body, a fifth in its first
comment), so an app that moves its access onto `@softure-ai/billing` with `manual()` keeps nothing of its own for them:

1. an "extend trial" form in `BillingAdminPage` (account email + the trial's new last day), recorded in the account
   history like manual grants, with `extendTrialAction` in `/next` and `extendTrialManually` in `/server`;
2. an exact mode of the import (`importEntitlement(…, { mode: "replace" })`, `import-entitlements --exact`), allowed
   only for an account that has no entitlement row yet, so an adoption can carry a trial shorter than the derived one;
3. a page `<h1>` inside `<main>` of `PaymentPage` and `BillingAdminPage` (from messages, overridable or hidden through
   a `heading` prop);
4. mailing: an optional per-mail `replyTo` on `OutgoingMail`, validated like `to`, with the config value as default;
5. migration `0010`: indexes behind the foreign keys `payment_requests.user_id`, `manual_grants.granted_by` and
   `manual_grants.revoked_by`.

A reviewer checks the billing tests (trial extensions, import, admin UI, privacy, migrations), the mailing send tests,
migration `0010`, the READMEs and the CHANGELOGs.

## Context

Issue #229, filed while an adopting app moved its trial, paid year and write guard onto billing 0.1.7. Work is tracked
in GitHub Issues: no roadmap item; the PR closes the issue. Released as billing 0.1.8 and mailing 0.1.10.

## Constraints

- Lock order of every entitlement change: account (key share) → entitlement row (`lockEntitlementRow`) → own row.
- Migrations move forward only and say how to roll back; the next free billing migration is `0010`.
- A refusal writes nothing (the pinned row is undone like `grantPlanManually` does).
- Privacy: the new table is exported and erased with the account; which admin acted is left out of the export.
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names each gap and its code path; reading `entitlement.ts`,
  `server/entitlements.ts`, `server/grants.ts`, `next/actions.ts`, `next/pages.tsx`, the admin UI, `privacy.ts`,
  migration `0004`, the import script, and mailing's `validate-mail.ts` / `send-mail.ts` answered every unknown; the
  findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter suggested; the open choices (date
  vs days in the form, whether a no-op extension is refused) are settled in the plan.
