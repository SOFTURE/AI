---
change_id: mailing-ledger-campaigns
title: "Delivery ledger and campaigns"
status: backlog
roadmap_item: EN-3
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`mailing.deliveries` and `mailing.campaigns` give exactly-once delivery (claim → sent | rejected, one outcome per recipient); a `softure-mail campaign` command sends a campaign from a content file over a regular database connection, honouring suppressions; a DNS check reports SPF, DKIM and DMARC for the sender domain.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **EN-3** (roadmap `engagement`, main since 2026-10-03):

> ### EN-3: Delivery ledger and campaigns
> - **Change ID:** `mailing-ledger-campaigns`
> - **Status:** ready
> - **Outcome:** `mailing.deliveries` and `mailing.campaigns` give exactly-once delivery (claim → sent | rejected, one outcome per recipient); a `softure-mail campaign` command sends a campaign from a content file over a regular database connection, honouring suppressions; a DNS check reports SPF, DKIM and DMARC for the sender domain.
> - **Prerequisites:** EN-2.
> - **Unknowns:** Batch size and retry policy for claimed-but-unsent rows; content file format (frontmatter + markdown?); how lifecycle mails (trial ending, etc.) register their kinds.
> - **Risk:** medium. Double sends are visible to users.
> - **Baseline:** FIRE runs campaigns through deployment-specific scripts. After: a campaign to N recipients produces exactly N ledger outcomes, re-running sends nothing new (unit + integration on PGlite).
> - **PRD refs:** FR-16, FR-17.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/mailing/` ledger, campaign CLI and DNS check, `modules/mailing/migrations/` (deliveries, campaigns).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
