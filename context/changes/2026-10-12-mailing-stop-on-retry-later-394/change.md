---
change_id: mailing-stop-on-retry-later-394
title: "mailing: runDeliveries and sendCampaign stop at the first retry-later (issue #394)"
status: archived
roadmap_item: null
issue: 394
branch: claude/project-thread-rfx9fc
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #394](https://github.com/SOFTURE/AI/issues/394): during a provider outage (`mailing.unavailable`, 5xx,
timeout) or a 429 rate limit, `runDeliveries` and `sendCampaign` keep going after the first `retry-later`, so every
following recipient spends an attempt and, after `maxAttempts` runs, is closed as `rejected` with nothing sent. After
this change both runs stop at the first `retry-later` by default, report it in `halted` with `remaining: null`, and an
app that wants the old behaviour passes `stopOnRetryLater: false`.

## Context

Issue #394 (labels `bug`, `adoption`, `pkg: mailing`), no roadmap item. `@softure-ai/mailing` 0.1.12 is on npm, so the
change goes under `## Unreleased` in the CHANGELOG and rides the next release (no version bump here). Issue #388
(billing) will build on `runDeliveries`, so the option and the summary shape must stay stable.

## Constraints

- Owned: `modules/mailing/` only.
- No address in any output; the CLI explains the new halt reason.
- English-only code and docs; no names of adopting apps.

## Notes

- Research: skipped. The issue names the function, the outcome and the attempt accounting; the code it touches
  (`run-deliveries.ts`, `campaigns.ts`, `deliveries.ts`, the CLI's halt output) is read in plan.md.
- Framing: skipped, the problem is observed by an adopter.

## Decisions (auto)

- Option `stopOnRetryLater?: boolean` (a boolean, not `stopOn: "retry-later"`: there is only one other stop and it is
  not optional). Default `true` in both `runDeliveries` and `sendCampaign`: continuing during an outage is what costs
  the attempts, and a stopped run loses nothing (the next run picks up where it stopped).
- The stop is reported as a halt: `halted: { reason: "mailing.unavailable", httpStatus? }`, `remaining: null`. The
  halt reason type widens to a new exported `RunHaltReason = HaltingErrorCode | "mailing.unavailable"`.
