# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mailing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mailing@x.y.z`).

## 0.1.9

- New `importDeliveries(ctx, rows)` (`/server`, and `importDeliveries(rows)` in `/next`) and `softure-mail import
  <file|->` (JSON Lines): seed `mailing.deliveries` with the deliveries an app made before it adopted the module, so
  the first `deliverOnce` or campaign run skips them. Rows `{ scope, address, status: "sent" | "rejected",
  finishedAt, providerMessageId?, reason?, kind? }`; every row is checked before anything is written, rows already
  in the ledger are left as they are, a re-run imports nothing twice. `checkImportedDeliveries` checks without
  writing (`--dry-run`).
- Migration `0004`: `mailing.deliveries.imported_at`; an imported `sent` row may have no `provider_message_id`.
  Run `softure migrate`.
- `maxAttempts` is a module option (default 5) and may be `null`, in the module or per `deliverOnce` call: then
  `mailing.unavailable` always releases the claim and never closes the delivery.
- `listCampaignRecipients(campaign, ctx)` module option: `softure-mail campaign` without `--recipients` takes the
  recipients from it. New `listConfiguredCampaignRecipients` in `/server`.
- `softure-mail` reads a file given as `-` from standard input (the campaign's content file or `--recipients`, the
  import's history file), so it runs inside the app's container with `docker compose exec -T`. The README documents
  that topology.
- `legacyUnsubscribe.params` also takes `{ required, optional }`: a link is legacy when it carries every required
  name, and the optional names it carries go to `verify` too, so two old link forms on one path both keep working.
  The array form still means "all required".
- `mailing({ oneClickInvalidLinkStatus: 200 })`: the one-click route answers 200 for a link that does not verify, so
  the answer never tells whether a token is live. The default stays 400; a failure still answers 500.
- `onUnsubscribed` receives `event.link`: `{ scheme: "signed" }` or `{ scheme: "legacy", values }` with the values
  `verify` accepted, so the hook can find the row a legacy link named. New types `LegacyUnsubscribeParams` and
  `VerifiedUnsubscribeLink`.

## 0.1.8

- `checkSenderDns` takes `expectDmarc: { policy, subdomainPolicy, adkim, aspf }`: a DMARC record weaker than it (a
  lower policy, relaxed or absent alignment where strict is required, `pct` under 100) fails with the new finding
  `weak`. Without the option nothing changes.
- `replyTo` checks that the reply domain accepts mail: MX records that are not a null MX (finding `null-mx`) and at
  most one SPF record.
- `returnPath: [{ host, targetDomain? }]` checks return-path hosts: a CNAME (to the target domain, else finding
  `unexpected-target`) or MX records. New `resendReturnPath(domain)` gives Resend's `send.` and `rsend.` hosts.
- `SenderDnsReport` has two new keys, `replyTo` (`null` when not asked) and `returnPath` (`[]` when not asked); new
  resolver options `resolveMx` and `resolveCname`.
- `softure-mail dns`: `--dmarc-policy`, `--dmarc-sp`, `--dmarc-adkim`, `--dmarc-aspf`, `--reply-to`,
  `--return-path`, `--resend-return-path`; without `--domain` it also checks the configured `replyTo`. New output
  lines `REPLY` and `PATH`.

## 0.1.7

- A failed send keeps the provider's HTTP status: `SendMailResult` failures and `deliverOnce` outcomes carry
  `httpStatus`, and `mailing.deliveries.provider_status` stores it (migration `0003`).
- New codes `mailing.provider_refused` (401/403: the key or account is refused) and `mailing.quota_exceeded` (429
  that is not a rate limit), with en/pl copy. Before, `resend()` read 401/403 as `rejected` and 429 as `unavailable`.
  Provider adapters may answer the new `refused` and `quota_exceeded` statuses.
- `deliverOnce` returns `halted` for both: nothing is closed, the claim is released with its attempt given back.
  `sendCampaign` (and `softure-mail campaign`) stops at the first one and reports `halted`; the rest of the list is
  left for the next run.
- `legacyUnsubscribe: { params, verify }`: unsubscribe links an app sent before adopting the module keep working on
  the page, its action and the one-click route. New `readUnsubscribeLink`; `unsubscribe` takes its result (a bare
  token still works).
- `filterCampaignRecipient`: campaigns skip recipients the app does not want to mail (e.g. by consent scope), without
  a ledger row; summaries and plans count them as `filtered`.
- `staleClaimMs` and `uncertainClaimMs` module options. **Changed default:** a claim older than 23 hours is no longer
  taken over by itself (`uncertain`), since the provider may have forgotten its idempotency key; pass
  `retakeUncertain` (`--resend-uncertain`) to send it anyway.

## 0.1.6

- Adapters and commands use the configured database handle; `@softure-ai/ui` is a peer dependency.
