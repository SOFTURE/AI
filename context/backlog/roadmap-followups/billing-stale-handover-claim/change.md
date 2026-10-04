---
change_id: billing-stale-handover-claim
title: "A request whose hand-over was cut off is handed over on a later ask"
status: backlog
roadmap_item: FU-34
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An invoice request whose hand-over claim is older than a bounded time (the process stopped between the claim and `onRequest`'s answer) counts as not handed over: the next ask claims it again and the owner hears of it; a unit test drives a claim left behind.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-34** (roadmap `followups`):

> ### FU-34: A request whose hand-over was cut off is handed over on a later ask
> - **Change ID:** `billing-stale-handover-claim`
> - **Status:** proposed
> - **Outcome:** An invoice request whose hand-over claim is older than a bounded time (the process stopped between the claim and `onRequest`'s answer) counts as not handed over: the next ask claims it again and the owner hears of it; a unit test drives a claim left behind.
> - **Prerequisites:** FU-33 on `master` (lane C).
> - **Unknowns:** How long a claim may stand (a provider's mail call takes seconds; a minute is generous) vs. a separate `handed_over` flag set only after `onRequest` answers `Ok` (two writes, no timeout); whether a retried hand-over can mail twice when the first did go out.
> - **Risk:** LOW. Only after a crash or a kill in the few milliseconds to seconds between the claim and the provider's answer; the admin page still lists the request and expiry clears it, but the owner may never get the mail.
> - **Baseline:** FU-27 `billing-invoice-request-hygiene`: `claimHandOver` sets `handed_over_at` before `onRequest` and `releaseHandOver` clears it on an `Err` or a throw; a process that dies in between leaves the claim, so later asks only refresh the request (`modules/billing/README.md` §12). After: the gap is closed and covered by unit tests.
> - **PRD refs:** FR-22.
> - **Source:** FU-27 `billing-invoice-request-hygiene` research (Risks) and README §12; `modules/billing/src/server/requests.ts` (`claimHandOver`), `modules/billing/src/server/plans.ts` (`startPayment`)

## Constraints

- Owns: `modules/billing/src/server/requests.ts` and `startPayment` in `src/server/plans.ts` (lane C, after FU-33).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-27 (`billing-invoice-request-hygiene`, 2026-10-04): a README §12 limitation it leaves open.
