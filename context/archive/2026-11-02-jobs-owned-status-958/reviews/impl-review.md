---
change_id: jobs-owned-status-958
verdict: approved
---

# Implementation review

Reviewed the diff of bb91953, 674b7f3, a395cec and 034c672 against plan.md and issue #958.

- Proposal 1 (owner on enqueue): `enqueueJob({ ownerId })`, 1 to 200 characters, stored in `owner_id` with an index
  `(owner_id, created_at DESC)`. The dedup key still matches across owners; documented.
- Proposal 2 (`getOwnJob`): the owner is in the query; another owner, no owner, a pruned job and a malformed id all
  answer `jobs.not_found`. `OwnJob` carries status, progress, `resultRef`, `failureCode` (code of a failed job,
  `jobs.cancelled` for a cancelled one), cancel request and times; tests assert the payload and a thrown error's text
  never appear. `resultRef` comes from `ok({ resultRef })`, checked as an identifier, dropped with a warning that
  does not repeat it; a table check keeps it on succeeded jobs only and `retryJob` clears it.
- Proposal 3 (route): `createJobStatusRoute` with `getOwnerId` from the app (no auth dependency), 401/404/200 for
  `GET`, `DELETE` behind `allowCancel` (405 otherwise; 200/404/409), 503 and 500 logged by kind only, `no-store` on
  every answer. `requestOwnJobCancel` keeps the owner in every statement, so no check-then-act gap.
- Proposal 4 (hook): `useJobStatus` in the new `./react` entry; the answer is parsed with a zod schema; backoff by
  half while unchanged, doubled after a failure, reset on a change; stops on terminal statuses and on 401/404;
  pauses in a hidden tab; polls at once on `visibilitychange` and `online`; `cancel()` with DELETE. Covered with fake
  timers and a stubbed `fetch`.
- Proposal 5 (retention): `retention.ownedDays` (default 1) as a floor in `pruneJobs`; tests for both directions.
- Migration 0009 (0008 until #955 merged its own 0008) is additive with a written rollback.
- Gates: typecheck and lint green (pre-commit), jobs suite and repository tests green (the deploy workflow test needed
  `ssh-keygen`, installed in the container).
- Language: English only; no copy inline; the route and the hook carry codes only.

Follow-ups: none. Verdict: approved.
