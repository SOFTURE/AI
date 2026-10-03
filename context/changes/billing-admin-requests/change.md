---
change_id: billing-admin-requests
title: "The billing admin page lists invoice requests, grants from them, revokes a grant and shows each account's history"
status: implementing
roadmap_item: FU-9
branch: claude/project-thread-43muam
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An admin running manual payments works from one page: the open invoice requests are listed (stored
in billing, not only handed to `onRequest`), each grants its plan in one click or is dismissed, a
mistaken manual grant is revoked (only what it added is taken back), and an account's history shows
its manual grants and provider payments. A lifetime account is told apart: the payment page says
there is nothing to pay, and a grant to it is refused instead of silently stacking an invisible
period.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-9).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-9** (roadmap `followups`):

> - **Outcome:** Invoice requests stored in a billing table and listed in `BillingAdminPage` with a one-click grant; a revoke action; a history of grants per account; optionally a `grant-plan` script; the payment page and the grant form tell a lifetime account apart (today it can still request an invoice, and a dated grant to it is a silent no-op).
> - **Unknowns:** One table for manual requests and provider payment events vs. two; retention of invoice details (personal data, privacy contributor).
> - **Baseline:** monetization MO-2 `billing-plans-pricing`: requests reach the owner only through `manual({ onRequest })` (the example mails them); the admin grants by email, cannot revoke and sees no history (README §12). After: the gap is closed and covered by unit and e2e tests.

FU-11 (PR #45) left the base this builds on: `billing.payments` records each payment's grant
(`grant_kind`, `granted_from`, `granted_until`, migration `0003`), `applyPlan` returns the grant it
applied, and `refundPayment` takes back one payment's grant under the lock order account →
payment → entitlement, moving later stored periods back (`shiftLaterPeriods`). Since FU-11 a dated
grant to a lifetime account extends the dated end kept under lifetime: no longer a no-op, but
still invisible to the admin.

## Constraints

- Exclusively owns: `modules/billing/` admin requests, grants, revoke and history; billing
  migration `0004`; the example's billing admin e2e. Lane C: FU-6, FU-20 and FU-21 follow and are
  not started here (FU-21 reads this change's grant history in the refund).
- FU-1, FU-2 and FU-5 run in parallel on other modules; `examples/next-app/e2e/migrations.spec.ts`
  may conflict (master wins, merge it in).
- Manual provider only; no Stripe calls.
- English-only code; user-facing copy only in the `en`/`pl` dictionaries. No release, tag or
  publish (owner).

## Notes

- Framing skipped: the problem and the expected outcome are stated by the roadmap item and the
  README §12 limitation; the open questions are design unknowns (tables, retention), which
  research answers.
- The optional `grant-plan` script is decided in research.
