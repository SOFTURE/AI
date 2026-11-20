---
change_id: quality-review-round-7
title: "jobs, security: close the findings of the seventh 2026-11-19 quality review round"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the seventh review round at 35c8e4f: jobs warning QR-cc26beec (runDueJobs runs handlers with
no lease heartbeat) and security suggestions QR-8be820fc (old webhook replays after the ledger prune) and
QR-bcbad772 (unsalted subject keys). Deploy came back clean.

## Context

Asked in chat (no issue): the loop of review, fixes and re-review until the reports are clean.

## Scope

- jobs `src/server/leased-run.ts`, `src/server/run-due.ts`: `LeasedRun.outcome`; runDueJobs runs every job through
  `startLeasedRun` (new option `heartbeatMs`).
- security `src/server/webhook.ts`: optional `eventTime(event)`; README §8 and §11.
- `quality-review.ignore`: QR-bcbad772 accepted with its reason.

## Notes

- Frame and research skipped: each finding names the file and the fix; the leased run already exists.

## Decisions (auto)

- runDueJobs keeps propagating a failed recording: it awaits `LeasedRun.outcome`, which rejects, while `done` keeps
  its never-rejecting contract for the worker and the tick.
- QR-bcbad772 is accepted, not fixed: an HMAC key needs a secret at every `subjectKey` caller (auth, files,
  waitlist, billing, privacy), none of which has a context there. The rows live two rate-limit windows; README §11
  now says the keys are pseudonymous.

## Done

- On master with the next releases: jobs and security (with `quality-review-security-jobs-deploy`).
