---
change_id: billing-stale-handover-claim
title: "A request whose hand-over was cut off is handed over on a later ask"
status: new
roadmap_item: FU-34
branch: claude/project-thread-fo2e3z
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An invoice request whose hand-over was claimed but never answered (the process stopped between
the claim and `onRequest`'s answer) is handed over again by the next ask once the claim is older
than a bounded time, so the owner hears of it. A hand-over that did answer `Ok` is never repeated.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-34).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-34** (roadmap `followups`):

> - **Outcome:** An invoice request whose hand-over claim is older than a bounded time (the process stopped between the claim and `onRequest`'s answer) counts as not handed over: the next ask claims it again and the owner hears of it; a unit test drives a claim left behind.
> - **Unknowns:** How long a claim may stand (a provider's mail call takes seconds; a minute is generous) vs. a separate `handed_over` flag set only after `onRequest` answers `Ok` (two writes, no timeout); whether a retried hand-over can mail twice when the first did go out.
> - **Source:** FU-27 `billing-invoice-request-hygiene` research (Risks) and README §12; `modules/billing/src/server/requests.ts` (`claimHandOver`), `modules/billing/src/server/plans.ts` (`startPayment`)

## Constraints

- Owns: `modules/billing/src/server/requests.ts`, `startPayment` in `src/server/plans.ts`, a new
  billing migration (`0008`), `src/schema.ts`, the billing README and the example app's migration
  ledger expectation (lane C, after FU-33; FU-35 is not done here).
- Asking again for an open request that was handed over still refreshes it without a hand-over.
- A gap found here is filed as a new FU item, not fixed (owner decision 2026-10-03).
- English only. No release, tag or publish (owner).

## Notes

- Research: kept, short. The item names two designs; which one works depends on what the column
  means today and on the paths that read or write it, checked in the code on `master` (d36276f).
- Framing skipped: the problem is a documented limitation (README §12, FU-27 research) with file
  references; nothing about the problem is in doubt, only how to close it.
