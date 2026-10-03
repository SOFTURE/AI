# Plan: mailing-ledger-campaigns

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

- Migration `0002_create_campaigns_and_deliveries.sql`; Drizzle tables; manifest `tables`; the
  health check covers all three tables.
- `/server`: `deliverOnce(ctx, { scope, mail, campaignId? }, options)` returning a union
  (`sent | rejected | done | in-flight | retry-later`); `parseCampaignFile`, `sendCampaign`
  (registers the campaign, refuses changed content with `mailing.campaign_changed`, sends through
  the ledger, returns counts); `checkSenderDns`.
- `/next`: `deliverOnce` on the registered config and the shared database.
- `/cli` and the `softure-mail` bin: `campaign <file> --recipients <file> [--dry-run] [--pause-ms]`
  and `dns [--domain] [--dkim-selector] [--spf-host]`.
- README, example `e2e/migrations.spec.ts` ledger line.

**Out of scope:** provider webhooks (bounces, complaints, delivered), per-recipient personalisation,
markdown rendering, scheduling campaigns, an admin view of the ledger.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Claim | one conditional upsert | atomic across processes | research 1 |
| Crash recovery | stale claim + same idempotency key | no double send inside the provider window | research 2 |
| Fencing | outcome `UPDATE … WHERE attempts = mine` | a late worker cannot overwrite | research 3 |
| Identity | recipient key, not address | no new personal data | research 4 |
| Pace | sequential, CLI pause 500 ms | provider limits are per second | research 7 |

Rejected: one transaction around claim + send (holds a connection across a network call and still
double-sends on a crash after the provider accepted); a kinds registry (scopes already separate
lifecycle mails); markdown content (dependency and two renderings).

## Phase 1: Ledger, campaigns and DNS check

**Discipline:** TDD.

- Migration, schema, manifest, health; `src/server/deliveries.ts`, `campaign-file.ts`,
  `campaigns.ts`, `dns.ts`; `/next` `deliverOnce`.
- Tests on PGlite: claim/outcome per result code, re-run sends nothing, stale claim retaken with the
  same key, fenced outcome, attempts limit, in-flight claim, constraints (scope, kind, campaign
  scope); campaign: N recipients give N outcomes, second run sends 0, changed content refused,
  suppressed recipient rejected and not retried, duplicates; content parser errors; DNS statuses.

## Phase 2: CLI, docs and example

**Discipline:** TDD for argument parsing and the command; test-after for the bin.

- `src/cli/` (`runMailCli`, `runMailCommand`, bin), `package.json` `bin` and `./cli` export.
- README sections, example migrations spec line.

## Risks and rollback

- Migration rollback: `DROP TABLE mailing.deliveries; DROP TABLE mailing.campaigns;` and delete
  ledger row version 2 (in the migration header). Code revert leaves `sendMail` as in EN-2.
- A wrong claim condition double-sends: the tests run two claims against one row and a stale one.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Ledger, campaigns and DNS check

#### Automated
- [x] 1.1 Ledger, campaign and DNS unit/integration tests on PGlite pass — dc07659
- [x] 1.2 `module.json` equals `toModuleJson(mailing)`; constraints and health check tested — dc07659
- [x] 1.3 Gates green (typecheck, lint, test) — dc07659

### Phase 2: CLI, docs and example

#### Automated
- [ ] 2.1 `runMailCli` tests (campaign, dry run, dns, usage errors) pass
- [ ] 2.2 Gates green (typecheck, lint, test, build)
