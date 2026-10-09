---
change_id: mailing-adoption-gaps-322
title: "mailing 0.1.12: batch delivery runner, SQL surface, preview and test send, campaign CLI parity, inbound DNS, page slots (issue #322)"
status: archived
roadmap_item: null
issue: 322
branch: claude/project-thread-f1jxmo
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #322](https://github.com/SOFTURE/AI/issues/322): an adopting app still writes about 1,300 lines around
`@softure-ai/mailing` 0.1.11. After this change it can drop them:

1. `runDeliveries` sends one mail per recipient through `deliverOnce`, stops at a refused account or a spent quota,
   honours `limit` and `pauseMs`, returns counts, and has a dry run that writes and sends nothing.
2. App SQL uses a stable surface instead of the tables: `mailing.recipient_key(text)` (equal to `getRecipientKey`),
   `mailing.is_suppressed(text)`, `mailing.was_delivered(scope, text)` and two views.
3. `previewMail(config, mail)` returns exactly what `sendMail` hands the provider (footer, RFC 8058 headers);
   `softure-mail test [<content-file>] [--kind] [--preview]` sends only to the configured `testAddress`.
4. `softure-mail campaign`: the dry run prints a preview; content with a pasted unsubscribe link or footer is refused;
   `kindAliases` resolve kinds; addresses in operator output are masked; `--content-file` lets the command run through
   `softure-deploy run`, which the README documents.
5. `checkSenderDns(domain, { inbound: "cloudflare" })` checks Cloudflare Email Routing's MX and SPF on the reply domain.
6. `legacyUnsubscribe.verify` receives the environment; `createUnsubscribePage({ classNames, unstyled, layout })`.

## Context

Issue #322 (labels `enhancement`, `adoption`, `pkg: mailing`), no roadmap item. 0.1.11 is released, so this is 0.1.12.
Issues #323 and #324 wait for this change (same package).

## Constraints

- Everything stays backwards compatible for an app on 0.1.11: new options are optional, new report keys are added.
- No address, link token or body reaches a log; operator output masks addresses and redacts link signatures.
- Migration 0005 moves forward only and says how to roll back. Functions in it qualify every name (`mailing.`).
- English-only code and docs; no names of adopting apps.

## Process notes

- Research: skipped. The issue lists the gaps with the adopter's own line counts, and the code they touch is read in
  plan.md's key decisions; nothing outside the package is in question.
- Framing: skipped, the problem is observed by the adopter.
