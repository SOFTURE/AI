---
change_id: mailing-ledger-campaigns
title: "Delivery ledger and campaigns: exactly-once delivery per scope and recipient, a softure-mail campaign command and a sender DNS check"
status: implementing
roadmap_item: EN-3
branch: claude/en-3-mailing-ledger-campaigns-1u6kkr
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`@softure-ai/mailing` records every mail that must go out at most once in `mailing.deliveries`:
one row per scope (a campaign, or a lifecycle event such as `billing.trial-ending:sub_42`) and
recipient, claimed before the send and closed with exactly one outcome (`sent` or `rejected`).
Re-running a send never mails the same recipient twice. `mailing.campaigns` pins a campaign's
content, so a re-run cannot quietly send different text under the same id. The `softure-mail`
command sends a campaign from a content file over a regular database connection (suppressed
recipients are rejected, not retried) and checks SPF, DKIM and DMARC for the sender domain.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-3**. Builds on EN-2
(list mail, suppressions, `sendMail({ config, db })`).

## Constraints

- Exclusively owns: `modules/mailing/` ledger, campaigns, CLI and DNS check, `modules/mailing/migrations/`
  (0002), the example's `e2e/migrations.spec.ts` ledger line for it.
- `sendMail` keeps its contract: EN-4 and the unsubscribe flow call it unchanged.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes

- 2026-10-03: research and plan written in the cloud session (`--auto`).
