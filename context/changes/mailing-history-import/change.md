---
change_id: mailing-history-import
title: "mailing: import of an existing delivery history, campaigns run where the database is, optional maxAttempts (issue #212)"
status: plan_reviewed
roadmap_item: null
issue: 212
branch: claude/project-thread-dc24mh
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close every point of [issue #212](https://github.com/SOFTURE/AI/issues/212), so an app that already keeps its own
exactly-once ledgers can switch to `deliverOnce` / `sendCampaign` without mailing anyone twice:

1. **History import.** `importDeliveries(ctx, rows)` seeds `mailing.deliveries` from the app's own ledger
   (`{ scope, address, status: "sent" | "rejected", finishedAt, providerMessageId?, reason?, kind? }`), idempotently,
   plus `softure-mail import <file|->` (JSON Lines) and a step in the adoption playbook.
2. **Campaigns where the database is.** The intended topology is documented: `softure-mail campaign` runs inside the
   app container (`docker compose exec -T app …`), the content file comes on stdin (`-`), and the recipients come from
   the app's database through a new module option `listCampaignRecipients` when `--recipients` is not given.
3. **Retry semantics.** `maxAttempts` becomes a module option and may be `null` (never close a delivery on
   `mailing.unavailable`); the README says why the default is 5.

A reviewer checks `tests/import.test.ts`, `tests/deliveries.test.ts`, `tests/cli.test.ts`, the README, docs/05 and the
CHANGELOG.

## Context

Issue #212, filed while an adopting app moved its batch sending to the package. Work is tracked in GitHub Issues, not
in a roadmap: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/mailing` and `docs/05-adoption-playbook.md`. Issue #211 changes mailing in parallel (unsubscribe
  links); both land in one release, mailing 0.1.9, published by whichever change merges second.
- Additive API: existing calls keep their meaning; the default `maxAttempts` stays 5.
- Migrations move forward only and say how to roll back.
- English-only code and docs; neutral public wording.

## Process notes

- Research: skipped as a separate file. The issue names the table, the key derivation and the options; reading
  `deliveries.ts`, `campaigns.ts`, `cli/run.ts`, `options.ts`, migrations `0002`/`0003` and the README (master
  `88fc13c`) settled every unknown. Findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter proposed; the open choices
  (placeholder vs. schema change for a sent row without a message id, where recipients come from in a container) are
  design decisions recorded in plan.md.
