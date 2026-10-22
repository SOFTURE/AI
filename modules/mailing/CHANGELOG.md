# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/mailing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`mailing@x.y.z`).

## Unreleased

- Attachments on `sendMail` and `deliverOnce` (#655): `attachments?: { filename, contentType, content: Uint8Array }[]`
  on a mail. Checked before sending (`mailing.invalid_input`, `fields=attachments`): at most `attachments.maxCount`
  files (default 10), at most `attachments.maxTotalBytes` raw bytes (default and maximum 28,000,000, about 37.3 MB
  base64, under the 40 MB cap), a filename without path separators or control characters, a content type on
  `attachments.contentTypes` (default `DEFAULT_ATTACHMENT_CONTENT_TYPES`). New option `attachments` in
  `mailing({ ... })`.
- `MailProvider.supportsAttachments`: a provider gets `ProviderMessage.attachments` only when it declares it;
  otherwise a mail with attachments is refused as `invalid_input` (`cause=provider_without_attachments`). `resend()`
  sends them as base64 with `content_type`; `fakeMailProvider()` captures them, and its outbox file stores them as
  base64 that `readMailOutbox` decodes back to bytes.
- The failure log line adds `attachments=<type>:<bytes>,...` (never filenames or content). `describeAttachments`
  returns `{ filename, contentType, size }[]`; `formatMailPreview` (`/server`) prints a `previewMail` value with an
  attachments section, and `softure-mail` previews use it.
- Queued deliveries carry no bytes: `enqueueDelivery` throws for a payload with a `Uint8Array`, `Buffer` or
  `ArrayBuffer`; `buildMail` loads attachments from the app's storage by reference.
- `validateMail(mail, options, limits?)` takes the attachment limits (default: the module defaults).
- Migrate an app:
  1. An app that bypasses mailing to send a file (a provider SDK or the user's mailbox API): call `sendMail` (or
     `deliverOnce`, or `enqueueDelivery` with the file's id in the payload and the bytes loaded in `buildMail`) with
     `attachments`, and delete the bypass.
  2. A content type outside the default list: pass `mailing({ attachments: { contentTypes: [...] } })` with the
     full list the app needs.
  3. A custom `MailProvider` that should carry attachments: map `message.attachments` and set
     `supportsAttachments: true`. Nothing to change otherwise.

## 0.2.3

- `softure-mail test` sends a list-kind test mail without the app database (#573). With `database: null` it skips the
  suppression check (the recipient is always `testAddress`, the operator's own), sends the mail with the unsubscribe
  footer and the RFC 8058 headers, and ends its output line with "no database, so the suppression list was not
  checked". Without `MAILING_UNSUBSCRIBE_SECRET` it is still refused; with a database nothing changes (an
  unsubscribed test address answers `suppressed`).
- The bin loads the config with the database optional for `test` and `dns`: an unset or empty database URL loads as
  `database: null` instead of refusing the config. `campaign` and `import` still need it.
- Migrate an app:
  1. An app that kept its own path for a test send without the database (`previewMail` with the list footer, then
     `sendMail` as transactional mail carrying it): delete it and run `softure-mail test <content-file>` (or
     `--kind <list kind>`) with the provider key, `MAILING_UNSUBSCRIBE_SECRET` and `testAddress`, without
     `DATABASE_URL`.
  2. From an app script (`runMailCli`), load the config inside `withDatabaseOptional` from `@softure-ai/core`, e.g.
     `const { default: config } = await withDatabaseOptional(() => import("../softure.config"));`, so a missing URL
     gives `database: null`.

## 0.2.2

- The unsubscribe page no longer posts to the URL that carries the signed token (#556). Its form sends the link in
  hidden fields to the one-click route's bare path (`routes.oneClick`); `postUnsubscribeRoute` records a POST
  whose URL has no link and whose URL-encoded body (at most 8 KiB) has one as a `page` opt-out and answers with a
  303 to the page's outcome (`/unsubscribe?status=done`, `invalid` or `failed`), as the server action did. A mail
  client's RFC 8058 one-click POST (link in the URL) is unchanged. With JavaScript the page also strips the link's
  parameters from the address bar after load (`history.replaceState`); without it the page still works.
- `unsubscribeAction` is unchanged and still exported, but the package page no longer uses it: a server action
  posts to the page's URL, query included.
- Migrate an app:
  1. Using the package page and route (`UnsubscribePage` or `createUnsubscribePage`, `postUnsubscribeRoute` on
     `routes.oneClick`): nothing to change. The route must stay mounted and public, as before.
  2. An app that kept its own unsubscribe page only to move the token out of the URL (hidden fields plus
     `history.replaceState`): delete that page and mount the package page instead
     (`export { UnsubscribePage as default } from "@softure-ai/mailing/next"`, or `createUnsubscribePage({ Layout })`
     for the app's frame).
  3. An app with its own form posting to `unsubscribeAction`: point the form at the route instead
     (`<form action="/api/mailing/unsubscribe" method="post">` with the link's `r` and `t`, or the legacy
     parameters, as hidden fields) to keep the token out of the POST URL.

## 0.2.1

- New entry `@softure-ai/mailing/jobs` (#492), with `@softure-ai/jobs` as an optional peer dependency:
  `enqueueDelivery(ctx, { queue, scope, payload })` enqueues a delivery in the caller's transaction (the scope is
  the job's dedup key); `defineDeliveryJobHandler({ payload, buildMail })` sends it through `deliverOnce` from the
  jobs worker and retries `retry-later` and `halted` (after the provider's `Retry-After`, else the queue's backoff);
  rejected mail fails at once; `getDeliveryJobResult` is the same mapping for an app's own handler. The payload holds
  the app's ids; the handler builds the mail when it runs. New job codes `mailing.delivery_in_flight` and
  `mailing.delivery_uncertain` with copy in `errors.mailing`. README, "Deliveries through jobs".
- `resend()` reads `Retry-After` (seconds or an HTTP date); `ProviderOutcome` failures, `SendMailFailure` and
  `deliverOnce`'s `retry-later` and `halted` outcomes carry it as the optional `retryAfterSeconds`. New export
  `readRetryAfter(header, nowMs)` for a provider adapter of the app's own. A strict equality on these results
  (`toStrictEqual`) sees the new field when the provider sends the header.
- `module.json → dependsOn` names `jobs` as optional (`"*?"`); an app with both modules lists `jobs()` anywhere in
  `modules`.
- Migrate an app that retries `retry-later` by hand (a cron that calls `deliverOnce` again, a "try again" kept for
  the user):
  1. `npm install @softure-ai/jobs`, add `jobs({ queues: { "<queue>": { maxAttempts } } })` and run the worker
     (jobs README, "Running the worker"); run the migrations.
  2. Register `defineDeliveryJobHandler({ payload, buildMail })` for the queue; move the code that built the mail
     into `buildMail`, reading the app's data by the ids in the payload.
  3. Replace the `deliverOnce` call in the request with `enqueueDelivery({ ...ctx, db: tx }, { queue, scope,
     payload })` inside the transaction of the write it belongs to, keeping the same `scope` (the ledger rows already
     sent stay sent).
  4. Drop the retry cron and the per-app attempt counting; `mailing({ maxAttempts })` now only applies to direct
     `deliverOnce` calls.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `mailing({ messages: { pl: myTranslation } })`; a key it leaves out reads
  English.
- `checkSenderDns(domain, { inbound: "cloudflare" })` (and `softure-mail dns --inbound cloudflare`) fails the inbound
  SPF check as `weak` unless the record's first `all` is `-all` or `~all`. Before, a record with the Email Routing
  include and `?all`, `+all`, a bare `all` or no `all` passed, though it lets anyone send as the domain. An app that
  kept its own check for this next to the report can drop it.

## 0.1.14

- The `@softure-ai/ui` peer range also accepts 0.2.0.

## 0.1.13

- `runDeliveries` and `sendCampaign` stop at the first `retry-later` (the provider is down, timed out or rate
  limited), as they stop at a refused account: `halted: { reason: "mailing.unavailable", httpStatus }`,
  `remaining: null`. Before, every following recipient got the same answer and spent an attempt, so an outage longer
  than `maxAttempts` runs closed them all as `rejected`. New option `stopOnRetryLater` (default `true`); pass `false`
  for the old behaviour. `halted.reason` (and `CampaignHalt`) is now the new exported `RunHaltReason`
  (`HaltingErrorCode | "mailing.unavailable"`): a map keyed by `HaltingErrorCode` over it needs the new entry.
  `softure-mail campaign` explains the new reason.

## 0.1.12

- New `runDeliveries(ctx, { recipients, build }, { limit, pauseMs, dryRun, onDelivery })` (`/server`, and
  `runDeliveries(input, options)` in `/next`): one `deliverOnce` per recipient, `build` returning the delivery or
  `null` to skip. Stops at a refused account or a spent quota (`halted`, `remaining: null`), counts `limit` like
  `sendCampaign`, and returns `DeliveryRunSummary` (`dryRun`, `recipients`, `skipped`, `sent`, `rejected` by code,
  `done`, `inFlight`, `retryLater`, `uncertain`, `halted`, `remaining`). A dry run writes and sends nothing.
- Migration `0005`: a SQL surface for the app's own queries, `mailing.recipient_key(text)` (equal to
  `getRecipientKey`), `mailing.is_suppressed(text)`, `mailing.was_delivered(scope, text)`, and the views
  `mailing.delivery_outcomes` and `mailing.suppressed_recipients`. Run `softure migrate`. Dropping
  `mailing.deliveries` or `mailing.suppressions` now needs `CASCADE`.
- New `previewMail(config, mail, { env })` (`/server`, `previewMail(mail)` in `/next`): exactly the
  `ProviderMessage` `sendMail` would hand the provider, footer and RFC 8058 headers included, without sending,
  logging or reading the database. New `maskAddress` and `redactUnsubscribeSignatures` for operator output.
- `mailing({ testAddress })` and `softure-mail test [<content-file>] [--kind <kind>] [--preview]`: sends a fixed
  test mail, or a campaign's content outside the ledger, to that address only.
- `softure-mail campaign`: the dry run prints the mail as the test address gets it (addresses masked, link
  signatures redacted); `--content-file <file>` names the content file for `softure-deploy run`, which the README
  documents. `getCampaignProblems(content, config)` also refuses a body with a pasted unsubscribe link or footer, and
  `sendCampaign`, `planCampaign` and the command refuse such content.
- `mailing({ kindAliases: { news: "newsletter" } })` and `resolveMailKind(config, kind)`: campaign files and
  `softure-mail test --kind` may name a kind by its alias.
- `checkSenderDns(domain, { inbound: "cloudflare" })` and `softure-mail dns --inbound cloudflare`: Cloudflare Email
  Routing's MX and one SPF record including `_spf.mx.cloudflare.net` on the reply-to domain (else the checked
  domain). New finding `missing-include`, new report key `inbound` (`[]` when not asked), new `CLOUDFLARE_INBOUND`.
  Code that builds a `SenderDnsReport` by hand must add `inbound`.
- `legacyUnsubscribe.verify(values, ctx, env)` receives the environment `unsubscribe` runs with.
- New `createUnsubscribePage({ classNames, unstyled, Layout })` in `/next`: slots `root`, `card`, `form`, `submit`,
  or the app's own layout around the copy and the form. `UnsubscribePage` is unchanged.
- New `findSuppressedAddresses(ctx, addresses)` (`/server`): which of many addresses unsubscribed, each
  returned as given, in batched queries; for reports such as the waitlist's suppressed split (#324).

## 0.1.11

- `sendCampaign(ctx, input, { limit })` hands at most `limit` mails to the provider in one run (sent, rejected by it,
  or not taken now); done, unsubscribed, filtered, in-flight and uncertain recipients do not count. `limit` must be a
  whole number of at least 1 (`RangeError` otherwise). `softure-mail campaign --limit <n>` passes it, exits 0 when
  the limit cut the run, and its dry run prints what one limited run would send.
- `CampaignSummary.remaining` (new, required): recipients past the cut that the next run would send to; `0` when the
  run reached the end of the list, `null` when it halted. Code that builds a summary by hand must add it.

## 0.1.10

- `OutgoingMail.replyTo`: an optional reply-to address for one mail (exactly one address, checked like `to`, failure
  field `replyTo`), sent instead of `mailing({ replyTo })`; without it the configured one is used. `ValidMail` carries
  it as `replyTo: string | null`. The `Reply-To` header stays reserved.

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
