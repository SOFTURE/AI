# Plan: mailing-adoption-gaps-322

Input: change.md (research and framing skipped, reasons there). Complexity: large (six phases, one package).

## Goal

`@softure-ai/mailing` 0.1.12 covers the six gaps of issue #322 with tests that fail on 0.1.11.

## Key decisions

- **runDeliveries.** `runDeliveries(ctx, { recipients, build }, options)` in `/server`, `runDeliveries(input, options)`
  in `/next` (more than three inputs become an options object). `build(recipient)` returns a `Delivery` or `null`
  (skipped). Options: `DeliverOptions` plus `limit`, `pauseMs`, `dryRun`, `onDelivery`, `sleep`, as in
  `sendCampaign`; `limit` counts mails handed to the provider. Summary `DeliveryRunSummary`: `dryRun`, `recipients`,
  `skipped`, `sent`, `rejected` by code, `done`, `inFlight`, `retryLater`, `uncertain`, `halted`, `remaining`. A dry
  run (and the count past the limit) reads the ledger and the suppression list and validates the mail, writing and
  sending nothing: `sent` then means "would be sent".
- **SQL surface (migration 0005).** `mailing.recipient_key(address text)`: base64url SHA-256 of the lowercased address
  trimmed of the whitespace JS `trim()` removes; IMMUTABLE STRICT. `mailing.is_suppressed(address)`,
  `mailing.was_delivered(scope, address)` (a `sent` row). Views `mailing.delivery_outcomes` (scope, recipient_key,
  kind, campaign_id, status, attempts, claimed_at, finished_at, imported_at) and `mailing.suppressed_recipients`
  (recipient_key, source, created_at): the columns are the contract, the tables may change under them. Non-ASCII
  upper case lowercases only under a UTF-8 ctype; the README says so.
- **previewMail.** `sendMail`'s composition moves into one function both use. `previewMail(config, mail, { env })`
  returns `Ok<ProviderMessage>` or a failure: `mailing.invalid_input` with `fields`, or `mailing.unavailable` with
  cause `no_unsubscribe_secret`. No database: it does not check the suppression list.
- **Test send.** Option `testAddress`. `softure-mail test [<content-file>] [--kind <k>] [--preview]`: without a file a
  fixed operator test mail (transactional unless `--kind`); with a file the campaign's content without the ledger.
  Refused without `testAddress`. List mail opens the database (suppression check); `--preview` prints and sends nothing.
- **Campaign CLI.** The dry run prints the preview for the test address (or `recipient@example.com`), signatures
  redacted. `getCampaignProblems(content, config?)` with a config also refuses a pasted unsubscribe link (the module's
  routes with `r=`, or an `r=<key>&t=` pair) and the footer copy of any locale; `sendCampaign` and `planCampaign` pass
  `ctx.config`. Option `kindAliases` (alias to kind); `resolveMailKind(config, kind)`; the CLI resolves the content
  file's `kind` and `--kind`. `maskAddress` for operator output. `campaign --content-file <file>` as an alternative to
  the positional, so `softure-deploy run` (words `--key=value` only) can send it on stdin; README section with
  `scripts/ops/mail-campaign.ts`.
- **Inbound DNS.** `inbound: "cloudflare"` checks the reply-to domain (else the checked domain): every MX under
  `mx.cloudflare.net` (`unexpected-target`, `null-mx`, `missing`), exactly one SPF record including
  `_spf.mx.cloudflare.net` (`multiple`, new finding `missing-include`). Report key `inbound: DnsCheck[]` (`[]` when not
  asked); CLI `--inbound cloudflare`, lines `INBOUND`.
- **Page and legacy verify.** `verify(values, ctx, env)`: `unsubscribe` passes its `env`. `createUnsubscribePage({
  classNames, unstyled, layout })`, slots `root`, `card`, `form`, `submit`; `layout` replaces the wrapper and receives
  `{ title, lead, children }`. `UnsubscribePage` stays as is.

## Phases

1. runDeliveries (`server/run-deliveries.ts`, `next/run-deliveries.ts`), tests first.
2. Migration 0005 and its tests on PGlite (key equality with `getRecipientKey` over mixed case and whitespace).
3. previewMail and `softure-mail test`.
4. Campaign CLI parity (preview, guard, aliases, masking, `--content-file`), README container section.
5. Inbound DNS.
6. Legacy verify env and the page factory.
7. Version 0.1.12 (package.json, module.json, manifest, lockfile), CHANGELOG, README.

Done when: `npm run typecheck`, `npm run lint`, `npm test` green.

## Progress

- [x] 1 runDeliveries
- [x] 2 SQL surface
- [x] 3 preview and test send
- [x] 4 campaign CLI
- [x] 5 inbound DNS
- [x] 6 page and verify env
- [x] 7 version, CHANGELOG, README
