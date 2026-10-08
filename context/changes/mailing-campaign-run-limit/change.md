---
change_id: mailing-campaign-run-limit
title: "A per-run send limit for sendCampaign, with the recipients left for the next run"
status: planned
roadmap_item: null
issue: "#238"
branch: claude/project-thread-besyqo
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Close [issue #238](https://github.com/SOFTURE/AI/issues/238). An operator on a provider plan whose daily quota is
shared with transactional mail sends a campaign in instalments ("at most 80 today") without reading the module's
delivery ledger in the app.

After this change:

1. `sendCampaign(ctx, input, { limit })` hands at most `limit` mails to the provider in one run. Recipients that are
   already done, unsubscribed, filtered out, uncertain or claimed by another run do not count against it.
2. The summary reports `remaining`: recipients past the cut that the next run would send to (the same notion as
   `planCampaign`'s `toSend`).
3. `softure-mail campaign --limit <n>` passes the limit; the dry run shows what one limited run would send.

## Context

- `sendCampaign` (`modules/mailing/src/server/campaigns.ts`) walks the list and calls `deliverOnce` for each
  recipient until the list ends or a delivery halts (`provider_refused`, `quota_exceeded`).
- It already knows which outcomes reached the provider (`reachedProvider`, used for `pauseMs`).
- `planCampaign` in the same file counts `toSend` from the ledger without writing.
- The CLI (`modules/mailing/src/cli/run.ts`) parses campaign flags and prints the summary.

## Constraints

- Backwards compatible: without `limit` a run behaves as today. `remaining` is a new summary field.
- Touches `modules/mailing/` only (source, tests, README, CHANGELOG) and this change folder.

## Notes

- Placement: unlinked (`roadmap_item: null`): the project works from GitHub issues, not a roadmap.
- Research and framing are skipped: the issue names the function and proposes the shape; `campaigns.ts` and the
  CLI's campaign path were read in full while writing this file, and the cut reuses two notions the file already
  has (`reachedProvider`, `toSend`).
