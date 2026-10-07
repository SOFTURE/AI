# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mailing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mailing@x.y.z`).

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
