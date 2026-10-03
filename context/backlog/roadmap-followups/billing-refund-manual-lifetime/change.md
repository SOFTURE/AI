---
change_id: billing-refund-manual-lifetime
title: "A manual lifetime grant survives a refunded paid lifetime"
status: backlog
roadmap_item: FU-21
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

When the admin granted lifetime access by hand and the account also paid for a lifetime that is
later refunded, the account keeps lifetime access.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-21** (roadmap `followups`):

> ### FU-21: A manual lifetime grant survives a refunded paid lifetime
> - **Change ID:** `billing-refund-manual-lifetime`
> - **Status:** proposed
> - **Outcome:** A refunded paid lifetime keeps lifetime access when the admin also granted it by hand.
> - **Prerequisites:** FU-9 on `master` (its grant history records manual grants).
> - **Unknowns:** Whether FU-9's grant history can be read in the refund's transaction under the entitlement lock; how a manual revoke after a manual lifetime counts.
> - **Risk:** LOW.
> - **Baseline:** FU-11 `billing-refund-one-payment`: a refunded paid lifetime ends lifetime unless another paid lifetime payment exists; manual grants have no payment row (README §12). After: manual lifetime grants count, covered by unit tests.
> - **Source:** FU-11 research ("Answers to unknowns", manual grants); `modules/billing/README.md` §12

## Constraints

- Owns: `modules/billing/` refunds (lane C, after FU-9).

## Notes
