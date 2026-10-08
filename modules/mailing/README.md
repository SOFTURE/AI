# @softure-ai/mailing

Sends one mail to one recipient through a provider adapter and answers with a typed result, never a
throw, with the sender, reply-to, provider and timeout taken from configuration, an HTML body, and a
fake provider for tests. List mail gets signed one-click unsubscribe (RFC 8058) and a suppression
list. A delivery ledger sends a mail at most once per scope and recipient, an app's earlier history
can be imported into it, and `softure-mail` sends campaigns from a content file.

## 1. What it provides

- `mailing({ from, replyTo, provider, timeoutMs, ... })` for `softure.config.ts` (section 3).
- `sendMail(context, mail, options)` in `@softure-ai/mailing/server` and `sendMail(mail, options)` in
  `@softure-ai/mailing/next` (on the registered config). The result is a core `Result`; a failure the
  provider answered with an HTTP status also carries it as `httpStatus`:

  | Result | Meaning | What the caller does |
  | --- | --- | --- |
  | `ok({ id, provider })` | the provider accepted the mail | keep `id` if it needs one |
  | `err("mailing.invalid_input")` | refused before anything left the process | fix the input; never retry |
  | `err("mailing.rejected")` | the provider refused this mail (4xx: bad address, key reused with another body) | do not retry the same request |
  | `err("mailing.provider_refused")` | the provider refused the account (401/403: missing, wrong or restricted API key, account not allowed to send) | stop sending: every mail fails the same way; fix the key or account, then retry |
  | `err("mailing.quota_exceeded")` | the account's sending quota is spent (429 that is not a rate limit: Resend's daily or monthly quota) | stop sending; retry when the quota renews |
  | `err("mailing.unavailable")` | provider down (5xx), 408, a rate limit (429 `rate_limit_exceeded`), a busy idempotency key, network, timeout, an answer without an id, no API key; for list mail also no unsubscribe secret or an unreadable suppression list | retry later with the same `idempotencyKey` |
  | `err("mailing.suppressed")` | a list mail to a recipient who unsubscribed; nothing was sent | skip the recipient; never retry |

- **List mail.** `kind: "transactional"` (the default) is mail the recipient needs whatever they
  unsubscribed from: resets, receipts, account notices. Any other kebab-case kind (`newsletter`,
  `product-updates`) is list mail: `sendMail` appends a footer with a signed unsubscribe link to the
  text and HTML bodies, adds `List-Unsubscribe: <one-click URL>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and refuses the mail with `mailing.suppressed`
  when the recipient unsubscribed. An unsubscribe covers every list kind.
- The unsubscribe page (`/unsubscribe`) and the one-click route (`/api/mailing/unsubscribe`) in `/next`,
  each mounted with one line (section 4).
- `@softure-ai/mailing/server`: `isSuppressed(ctx, address)`, `suppressRecipient(ctx, address)` (for
  scripts, bounce or complaint handlers), `unsubscribe(ctx, link, source)` (a link from
  `readUnsubscribeLink(params, config)`, or a bare token),
  `liftSuppression(ctx, address)` (a new explicit consent lifts the person's own opt-out),
  `buildUnsubscribeLinks`, `getRecipientKey`, and the footer and header helpers.
- **An `onUnsubscribed` hook**, run in the opt-out's transaction, so the consent ledger can record
  the withdrawal, and **`legacyUnsubscribe`**, which keeps unsubscribe links the app sent before it
  adopted the module working (section 10).
- **Sending once.** `deliverOnce(ctx, { scope, mail })` (`/server`, and `deliverOnce({ scope, mail })`
  in `/next`) sends a mail at most once per scope and recipient through the delivery ledger;
  `importDeliveries` (and `softure-mail import`) seeds it with the app's earlier history.
- **Campaigns.** `sendCampaign`, `planCampaign` and the content file parser in `/server`; the
  `softure-mail campaign` command sends a campaign from a content file.
- **Sender DNS.** `checkSenderDns(domain)` and `softure-mail dns` report SPF, DKIM and DMARC, hold DMARC to a
  required minimum, and check the reply-to domain's MX and the provider's return-path hosts.
- The `MailProvider` contract and `resend()`, the first adapter.
- `@softure-ai/mailing/testing`: `fakeMailProvider()` and `readMailOutbox(file)`.

```ts
import { sendMail } from "@softure-ai/mailing/next";

const result = await sendMail(
  { to: user.email, subject: messages.summary.subject, text, html },
  { idempotencyKey: `weekly-summary:${user.id}:${week}` },
);
if (!result.ok) return result; // a code; the UI shows getMailingErrorMessage(messages, result.error)

// List mail: footer, headers and the suppression check come with the kind.
await sendMail({ to: user.email, subject, text, html, kind: "newsletter" }, { idempotencyKey: `newsletter-12:${user.id}` });
```

From scripts and other modules, `/server` takes the context: `sendMail({ config }, mail)` for
transactional mail, `sendMail({ config, db }, mail)` for list mail (the suppression check reads
the database; list mail without `db` throws, as a wiring bug).

Rules that hold for every send:

- **One recipient.** `to` is exactly one address; a list is a loop. No cc or bcc.
- **Text always, HTML optionally.** `text` is required; `html` is a string the app rendered (from a
  template string or React email components rendered to a string: the module does not render).
- **Headers cannot take over the mail.** `headers` is for headers like `List-Unsubscribe`;
  `From`, `Sender`, `To`, `Cc`, `Bcc`, `Reply-To`, `Subject`, `Return-Path`, `Content-Type`,
  `Content-Transfer-Encoding` and `MIME-Version` are refused in any case, as are line breaks in
  values and the subject.
- **Nothing of the mail is logged.** One line per failure:
  `mailing: send failed provider=resend reason=rejected status=422` (with `fields=to,subject` for
  invalid input). Provider refusal messages are never read: they can echo the address.
- **Timeout.** After `timeoutMs` the provider's signal aborts and the send answers `unavailable`,
  even when the provider ignores the signal.
- **List mail fails closed.** No secret or an unreadable suppression list means nothing is sent.
  A list mail cannot bring its own `List-Unsubscribe` or `List-Unsubscribe-Post`: the module writes
  them (`invalid_input`).

**How a link works.** The link carries `r`, the base64url SHA-256 of the trimmed, lowercased
address, and `t`, the base64url HMAC-SHA256 of a fixed prefix plus `r` under
`MAILING_UNSUBSCRIBE_SECRET`. The address never appears in a URL, and the suppression table stores
only `r`. The page (footer link) shows a button and changes nothing on open: mail scanners open
links. The one-click route takes a mail client's POST without a session, verifies before touching
the database and answers 200 (recorded, also again), 400 (link does not verify; 200 with
`oneClickInvalidLinkStatus: 200`) or 500 (database failure, so the client retries); a GET redirects
to the page. The whole link is a credential: it is
never logged.

### Sending once: the delivery ledger

`deliverOnce` claims a row in `mailing.deliveries` for the scope and the recipient before it calls
`sendMail`, and closes it with one outcome. A second call for the same scope and recipient (any
case or spacing of the address) sends nothing:

```ts
import { deliverOnce } from "@softure-ai/mailing/next";

const outcome = await deliverOnce({
  scope: `billing.trial-ending:${subscription.id}`,
  mail: { to: user.email, subject, text, kind: "account-notices" },
});
```

| Outcome | Meaning |
| --- | --- |
| `{ status: "sent", id }` | sent now |
| `{ status: "rejected", reason, httpStatus? }` | refused now, for good: `mailing.suppressed`, `rejected`, `invalid_input`, or `unavailable` on the last attempt |
| `{ status: "done", outcome }` | an earlier call closed it (`sent` or `rejected`); nothing sent |
| `{ status: "in-flight" }` | another sender holds a fresh claim; nothing sent |
| `{ status: "uncertain" }` | a claim older than `uncertainClaimMs` is open: its send may have gone out; nothing sent (see Retries) |
| `{ status: "retry-later", httpStatus? }` | the provider was unavailable; the claim is released, call again later |
| `{ status: "halted", reason, httpStatus? }` | `mailing.provider_refused` or `mailing.quota_exceeded`: the account cannot send. The claim is released with its attempt given back; stop sending and call again once the account can send |

- **Scopes** name what the mail is about and are the only registration a lifecycle mail needs:
  `<module>.<event>:<entity>` (`billing.trial-ending:sub_42`, `waitlist.welcome:<signup id>`).
  Lowercase letters, digits and `._:-`, at most 128 characters. Campaigns use `campaign:<id>`.
- **Idempotency key.** The ledger sends with `<scope>:<recipient key>`; callers do not pass one.
- **Retries.** `unavailable` releases the claim (`pending`); the fifth attempt (`maxAttempts`) that
  is still unavailable closes the row as `rejected`. Five rides out a short provider outage across
  a few runs, while a provider that keeps failing on one mail does not keep it open forever. An app
  that retries on its own schedule sets `mailing({ maxAttempts: null })` (or passes it per call):
  `unavailable` then always releases the claim and never closes the row. A halt (`provider_refused`, `quota_exceeded`)
  never closes a row and never uses up an attempt, so a run with a bad key loses no recipient. The
  provider's HTTP status of the last failed answer is kept in `provider_status`.
- **Interrupted sends.** A process that dies between the send and the outcome leaves a claim; after
  `staleClaimMs` (15 minutes) another call takes it over and sends again with the same idempotency
  key, which the provider folds into the first send while it keeps the key (Resend: 24 hours). A
  claim older than `uncertainClaimMs` (23 hours) is `uncertain`: the provider may have forgotten the
  key, so a retake could mail twice, and it waits for an operator. Check the provider's log, then
  pass `retakeUncertain: true` (`softure-mail campaign --resend-uncertain`) to send it anyway. Both
  windows are module options, and `deliverOnce(ctx, delivery, { staleClaimMs, uncertainClaimMs })`
  overrides them per call. Outcomes are fenced by the attempt number, so a sender that lost its
  claim cannot overwrite the one that took over.
- A malformed scope or kind throws (a bug); a database failure propagates.

### Importing an existing history

An app that already kept its own once-only records (which campaign went to which signup, which
notice went to which user for which period) seeds the ledger before its first `deliverOnce` or
campaign run; otherwise that run mails everyone again. Map each record to the scope the module
will use for it and import:

```ts
import { importDeliveries } from "@softure-ai/mailing/server";

const result = await importDeliveries(ctx, [
  { scope: "campaign:2026-09-launch", address: "ada@example.org", status: "sent", finishedAt: "2026-09-20T10:15:00Z", kind: "newsletter" },
  { scope: "account.trial-ending:user_7", address: "bob@example.org", status: "rejected", finishedAt: row.sentAt, reason: "mailing.rejected" },
]);
if (!result.ok) console.error(result.problems); // [{ index, problem }]: nothing was written
else console.log(result.value); // { rows, imported, alreadyPresent, duplicates }
```

Or from a file, one JSON object per line with the same fields:

```bash
softure-mail import history.jsonl --dry-run   # checks the file, writes nothing
softure-mail import history.jsonl
docker compose exec -T app npx softure-mail import - < history.jsonl   # inside the app's container
```

- Rows: `scope`, `address` (only its key is stored), `status` (`sent` or `rejected`), `finishedAt`
  (a date or ISO string, not in the future), optional `providerMessageId` (sent rows; history
  rarely kept it, and an imported sent row may go without), `reason` (rejected rows: one of
  `mailing.invalid_input`, `rejected`, `unavailable`, `suppressed`; default `mailing.rejected`) and
  `kind` (default `transactional`).
- **Every row is checked before anything is written**; problems name the row (the file's line) and
  the field, never the address.
- **Idempotent.** A row whose scope and recipient the ledger already has (imported earlier, or sent
  by the module) is left as it is and counted as `alreadyPresent`; re-run the same import after a
  failure. Two input rows for the same scope and recipient count once (`duplicates`).
- Imported rows are closed (`sent` or `rejected`), with `imported_at` set and no `campaign_id`:
  `deliverOnce`, `planCampaign` and `sendCampaign` match a delivery by scope, so they skip it.
- Unsubscribes the app recorded go to `suppressRecipient`, not here: the suppression list is what
  stops future campaigns.

### Campaigns: `softure-mail campaign`

A campaign is one list mail to many recipients through the ledger. The content file is frontmatter
and a plain-text body; `html` (optional) names a file next to it:

```text
---
id: 2026-10-launch
kind: newsletter
subject: Something new in Plan
html: launch.html
---
Hello,

we shipped something.
```

```bash
softure-mail campaign launch.md --recipients recipients.txt --dry-run   # counts, sends nothing
softure-mail campaign launch.md --recipients recipients.txt              # sends
```

- The recipients file holds one address per line (`#` comments and blank lines skipped).
- **Recipients from the database.** Without `--recipients` the command asks
  `mailing({ listCampaignRecipients })`, which lists the addresses from the app's own data
  (duplicates are fine; the filter and the suppression list still apply):

  ```ts
  listCampaignRecipients: async ({ kind }, ctx) => listOptedInAddresses(ctx.db, kind),
  ```

- **Where it runs.** The command needs the database (the ledger) and the provider key, so it runs
  where both are: inside the app's container. When the database is not reachable from the
  operator's machine, send the content file on standard input (`-`) and let the recipients come
  from `listCampaignRecipients` (or pass `--recipients -` with the content as a file in the image):

  ```bash
  ssh app-host 'cd /srv/app && docker compose exec -T app npx softure-mail campaign - --dry-run' < launch.md
  ssh app-host 'cd /srv/app && docker compose exec -T app npx softure-mail campaign -' < launch.md
  ```

  With the content on standard input, its `html:` file is looked up in the working directory.
- The command loads `softure.config.*` like `softure migrate` (or `--config <file>`), opens the
  config's `database.handle` when set, otherwise its own connection on `database.url`, and needs `MAILING_UNSUBSCRIBE_SECRET` (campaigns are list
  mail). Run `softure migrate` first.
- Sends go one at a time with a 500 ms pause (`--pause-ms`; Resend allows 2 requests per second by
  default). Unsubscribed recipients are rejected without a send and never retried.
- **Recipient filter.** With `mailing({ filterCampaignRecipient })` every recipient is checked before
  the ledger is touched, e.g. against the consent scope the app stored for the address. A refused
  recipient is counted as `filtered out` and gets no row, so a later run sends to them once they
  qualify:

  ```ts
  mailing({
    from: "…",
    provider: resend(),
    filterCampaignRecipient: async ({ address }, ctx) => hasNewsletterConsent(ctx.db, address),
  }),
  ```

- **A refused key or a spent quota stops the run** at the first such answer: the command prints why
  (with the HTTP status) and exits 1; that recipient and every one after it are left for the next
  run. `sendCampaign` returns the same as `halted: { reason, httpStatus }`.
- **Re-runs are safe.** Recipients with an outcome are skipped; the command exits 1 while some have
  none yet (`retry later`, `in flight`): run the same command again. It also exits 1 for `uncertain`
  recipients (an interrupted send older than `uncertainClaimMs`) and names `--resend-uncertain`. `mailing.campaigns` pins the
  content by hash: other content under the same id is refused, so a changed campaign needs a new id.
- From a script (a bundled container, a list built from the database), call
  `runMailCli({ config, argv })` from `@softure-ai/mailing/cli`, or `sendCampaign(ctx, { campaign,
  recipients })` from `/server`, where `recipients` may be an async iterable.

### Sender DNS check: `softure-mail dns`

```bash
softure-mail dns                                       # the domain of `from` (and replyTo) in the config
softure-mail dns --domain mail.example.com --spf-host send.mail.example.com
softure-mail dns --spf-host send.mail.example.com --resend-return-path \
  --dmarc-policy reject --dmarc-sp reject --dmarc-adkim s --dmarc-aspf s
```

It reports each check as `pass`, `warn` or `fail`, exiting 1 on any `fail`:

- **SPF**: one `v=spf1` record on the domain or each `--spf-host`; `+all` warns. Resend publishes SPF on
  `send.<domain>`.
- **DKIM**: a non-empty `p=` at `<selector>._domainkey.<domain>`; selector `resend` unless `--dkim-selector` is given.
- **DMARC**: `_dmarc.<domain>` or a parent domain's record; `p=none` warns: it only reports. With a required minimum
  (`expectDmarc: { policy, subdomainPolicy, adkim, aspf }`, or the `--dmarc-*` flags) a weaker record fails as
  `weak`: `p=quarantine` where `reject` is required, `adkim=r` (or no `adkim`) where `s` is required, `pct` under 100
  when a policy is required. A stricter record passes, so adding `rua=` or tightening a tag never turns it red. For
  an inherited record the domain's policy is `sp`, else `p`.
- **REPLY** (when `replyTo` is configured and `--domain` is not given, or with `--reply-to`; `replyTo` option of the
  function): the reply domain must have MX records that are not a null MX (`0 .`, "accepts no mail") and at most one
  SPF record. Without it replies bounce while every sender check is green.
- **PATH** (`returnPath: [{ host, targetDomain? }]`, `--return-path <host>`, `--resend-return-path`): each host must
  be a CNAME (to `targetDomain` or under it, when set) or have MX records. `resendReturnPath(domain)` (the flag) gives
  Resend's `send.<domain>` and `rsend.<domain>` with target `rmta.net`; a domain Resend set up with MX records on
  `send` and no `rsend` checks `--return-path send.<domain>` alone.

It cannot see whether the provider signs with the published key. The function takes `resolveTxt`, `resolveMx` and
`resolveCname` for tests; by default it asks the system resolver.

## 2. Installation

```bash
npm install @softure-ai/mailing @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
```

Peer dependencies: `drizzle-orm`, and `next` and `react` for the `/next` adapter. The module needs a
database (its suppression list). The `/testing` entry imports `node:fs`.

## 3. Configuration

```ts
import { mailing, resend } from "@softure-ai/mailing";

// in defineSoftureConfig({ modules: [...] }):
mailing({
  from: "Plan <hello@mail.example.com>",
  replyTo: "support@example.com",
  provider: resend(),
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `from` | `string` | required | `addr` or `Name <addr>` (no commas, semicolons or quotes in the name). Must be on the domain the provider signs (DKIM); with DMARC `adkim=s` exactly that subdomain. |
| `replyTo` | `string` | none | One address for replies; may be on another domain (DMARC does not check it). |
| `provider` | `MailProvider` | required | `resend()`, `fakeMailProvider()` or your own adapter. |
| `timeoutMs` | `number` | `10000` | 1000 to 60000. |
| `onUnsubscribed` | `(event, ctx) => Promise<void>` | — | Runs on every verified unsubscribe, in its transaction (section 10). |
| `legacyUnsubscribe` | `{ params, verify }` | — | Verifies unsubscribe links the app sent before it adopted the module (section 10). |
| `oneClickInvalidLinkStatus` | `200 \| 400` | `400` | What the one-click route answers for a link that does not verify. `200` gives no oracle on whether a token is live; a failure still answers 500, and the page still shows its message. |
| `filterCampaignRecipient` | `(recipient, ctx) => Promise<boolean>` | — | Decides per recipient whether a campaign goes to them (section 1, Campaigns). |
| `listCampaignRecipients` | `(campaign, ctx) => Iterable<string> \| AsyncIterable<string> \| Promise<Iterable<string>>` | — | Lists a campaign's recipients from the app's data; `softure-mail campaign` uses it without `--recipients` (section 1, Campaigns). |
| `maxAttempts` | `number \| null` | `5` | Claims before `mailing.unavailable` closes a delivery as rejected, 1 to 100; `null` never closes it (section 1, Retries). |
| `staleClaimMs` | `number` | `900000` (15 min) | How long a delivery claim may stay open before another sender takes it over. 1 minute to 23 hours. |
| `uncertainClaimMs` | `number` | `82800000` (23 h) | How old a claim may get before it waits for an operator (`uncertain`). More than `staleClaimMs`, at most 30 days; keep it under the provider's idempotency window. |
| `routes` | `{ unsubscribe?, oneClick? }` | `/unsubscribe`, `/api/mailing/unsubscribe` | Where you mount the page and the route; links are built on `appOrigin` plus these paths. |

`resend({ apiKey?, endpoint?, fetch? })`: without `apiKey` it reads `RESEND_API_KEY` on every send,
so the configuration loads at build time without the secret.

**Your own provider:**

```ts
const provider: MailProvider = {
  name: "postmark",
  async send(message, { signal }) {
    const response = await fetch(URL, { method: "POST", body: toBody(message), signal });
    if (response.ok) return { status: "sent", id: (await response.json()).MessageID };
    const httpStatus = response.status;
    if (httpStatus === 401 || httpStatus === 403) return { status: "refused", httpStatus };
    if (httpStatus === 429) return { status: "unavailable", httpStatus }; // or "quota_exceeded" for a spent quota
    return { status: httpStatus >= 500 ? "unavailable" : "rejected", httpStatus };
  },
};
```

A provider receives a validated `ProviderMessage` (`from`, `to`, `replyTo`, `subject`, `text`, `html`,
`headers`, `idempotencyKey`, nulls for what is absent) and answers `sent` with an id, or `rejected`
(this mail), `refused` (the account or key), `quota_exceeded` (the account's quota) or `unavailable`
(try later), each with an optional `httpStatus`. A throw or anything else reads as `unavailable`.

## 4. Mounting

Two files, one line each:

```ts
// app/unsubscribe/page.tsx
export { UnsubscribePage as default } from "@softure-ai/mailing/next";
```

```ts
// app/api/mailing/unsubscribe/route.ts
export { getUnsubscribeRoute as GET, postUnsubscribeRoute as POST } from "@softure-ai/mailing/next";
```

Both must stay public: keep them out of the auth guard's `protect` list. The route has no per-IP
rate limit on purpose: mail providers post from a few shared addresses that act for millions of
people, so a bucket would refuse real unsubscribes; the signature is checked before any database
access and the only write is an idempotent insert. Behind a proxy that logs failed requests with
their query, a 500 puts the link in that log; it is the one place it can appear.

Call `sendMail` from server actions, route handlers (`/next`) or scripts and other modules
(`/server`, with `{ config }` or `{ config, db }`).

## 5. Migrations and tables

Schema `mailing`, applied by `softure migrate`:

| Migration | Table | What it holds |
| --- | --- | --- |
| `0001_create_suppressions.sql` | `mailing.suppressions` | `recipient_key` (primary key, 43-character base64url), `source` (`one-click`, `page`, `operator`), `created_at`. One row per address, the first opt-out kept. |
| `0002_create_campaigns_and_deliveries.sql` | `mailing.campaigns` | `id` (kebab-case), `kind` (never `transactional`), `subject`, `content_hash` (sha256 of kind, subject and bodies), `created_at`. |
| | `mailing.deliveries` | primary key (`scope`, `recipient_key`), `kind`, `campaign_id` (then `scope` is `campaign:<id>`), `status` (`pending`, `claimed`, `sent`, `rejected`), `attempts`, `claimed_at`, `finished_at`, `provider_message_id` (exactly when sent; see `0004`), `reason` (exactly when rejected). |
| `0003_add_delivery_provider_status.sql` | `mailing.deliveries` | `provider_status` (the HTTP status of the last failed or released answer, 100 to 599, else null); `attempts` may be 0 on a `pending` row (a halt gave its attempt back). |
| `0004_allow_imported_deliveries.sql` | `mailing.deliveries` | `imported_at` (set by `importDeliveries`, only on `sent`/`rejected` rows); `provider_message_id` only on `sent` rows, and required there unless the row was imported. |

The health check (`checkMailingTables`) runs `select 1 from mailing.<table> limit 0` for the three
tables.

## 6. Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | with `resend()` and no `apiKey` | Resend API key. Missing at send time: `unavailable` and a log line naming the variable. |
| `MAILING_UNSUBSCRIBE_SECRET` | to send list mail | Signs and verifies unsubscribe links; at least 32 characters (`openssl rand -base64 32`), a shorter one counts as missing. Missing at send time: list mail answers `unavailable` with a log line naming the variable; transactional mail is unaffected. |
| `MAILING_UNSUBSCRIBE_SECRET_PREVIOUS` | during a rotation | The secret before the current one: verifies links in mail already sent, never signs. |

**Rotating the secret.** Links live as long as the mail that carries them. Never replace the
secret outright: move the current value to `MAILING_UNSUBSCRIBE_SECRET_PREVIOUS`, set a new
`MAILING_UNSUBSCRIBE_SECRET`, and keep the previous one for as long as old mail may still be
clicked. Losing the secret means every link already sent stops working.

## 7. Switches

None.

## 8. Appearance

The unsubscribe page is a `Card` from `@softure-ai/ui` with a plain form (no client JavaScript),
styled by the app's tokens.

## 9. Copy

`src/messages/{en,pl}.ts`: `errors.mailing.{invalid_input,rejected,unavailable,suppressed,provider_refused,quota_exceeded}`,
`footer.{text,htmlLead,htmlLink}` (the list-mail footer, in the app's locale) and
`unsubscribe.*` (the page). `getMailingErrorMessage(messages, code)` returns the copy for a code;
override any text with `mailing({ messages: { en: { footer: { text: "…" } } } })`.

## 10. Hooks

The provider is the extension point (section 3).

**`onUnsubscribed(event, ctx)`** runs on every verified unsubscribe (the page's button or a mail
client's one-click POST), also a repeated one, in the transaction that stores the opt-out:
`event` is `{ recipientKey, source, link }` (the key is privacy's email key of the same address, never the
address; `link` is `{ scheme: "signed" }` or `{ scheme: "legacy", values }` with the values `verify`
accepted, so a hook can find the row a legacy link named), `ctx.db` is the transaction. A throw rolls the opt-out back: the route answers 500 and the
page offers a retry, so the opt-out and what the hook records never disagree. It does not run for
`suppressRecipient` (a bounce or a script is not the person's choice). Wire the waitlist's handler,
which withdraws its consents in privacy's ledger:

```ts
import { withdrawWaitlistConsents } from "@softure-ai/waitlist/server";

mailing({ from: "…", provider: resend(), onUnsubscribed: withdrawWaitlistConsents }),
```

**`legacyUnsubscribe: { params, verify }`** keeps unsubscribe links working that the app sent
before it adopted the module, in its own scheme (an HMAC over a sign-up id, say, on its own path).
`params` are the old link's query names (never `r` or `status`, which the module's links and page
own; `t` may be shared). An array names parameters the link must all carry; `{ required, optional }`
also names ones it may carry, for an app that sent more than one form on the same path (at most 8
names in all, at least one required). A link without `r` that carries every required one
(non-empty, at most 512 characters) is a legacy link, and its values also hold the optional ones it
has (an empty one counts as absent, one over 512 characters makes the link invalid): the page shows the same button with the values in hidden fields,
and the action and the one-click POST call `verify(values, ctx)`. It returns the recipient's
**address** when the link is genuine, else `null`; the module records the opt-out under that
address's key and runs `onUnsubscribed`, exactly as for its own links. `verify` must check the
link's signature itself (in constant time): whatever address it returns is unsubscribed. A throw is
a failure (the page offers a retry, the route answers 500), not an invalid link. Mount the module's
page and route at the old paths too:

```ts
mailing({
  from: "…",
  provider: resend(),
  legacyUnsubscribe: { params: ["u", "t"], verify: ({ u, t }, ctx) => verifyOldLink(ctx.db, u, t) },
}),

// app/old-unsubscribe/page.tsx
export { UnsubscribePage as default } from "@softure-ai/mailing/next";
```

Two forms on one path (a signed `?u=<id>&t=<hmac>` in mail and a bare `?t=<token>` shown after
sign-up), an opt-out recorded on the app's own row, and a one-click route that never tells a live
token from a dead one:

```ts
mailing({
  from: "…",
  provider: resend(),
  oneClickInvalidLinkStatus: 200,
  legacyUnsubscribe: {
    params: { required: ["t"], optional: ["u"] },
    verify: ({ u, t }, ctx) => (u === undefined ? findAddressByToken(ctx.db, t) : verifyOldLink(ctx.db, u, t)),
  },
  onUnsubscribed: async (event, ctx) => {
    if (event.link.scheme === "legacy") await markSignupUnsubscribed(ctx.db, event.link.values);
  },
}),
```

**`liftSuppression(ctx, address)`** is the other direction: a module that has just recorded a new
explicit consent (the waitlist's sign-up) calls it in that consent's transaction. It deletes the
row only when its source is `page` or `one-click`; an `operator` row stays. It returns whether it
lifted one.

**Tests and e2e:** `fakeMailProvider()` keeps accepted mail in `provider.sent` (with the id it
answered) and honours idempotency keys like a real provider. `respond: (message) => ({ status:
"rejected" })` simulates failures. With `outboxFile` it also appends each mail as one JSON line, so a
test in another process (Playwright against `next start`) reads it with `readMailOutbox(file, { to })`.
Without an outbox file it refuses to run under `NODE_ENV=production`, where in-memory mail would
vanish. The example app sets `MAIL_OUTBOX` for its e2e (`examples/next-app/e2e/mailing-transport.spec.ts`).

## 11. GDPR

Addresses and content go to the provider only; never to logs or results. The suppression list
stores a SHA-256 of the address, not the address: pseudonymous data (it can be matched against a
known address), kept after an account is deleted because it records the person's objection to
mail. The delivery ledger also stores recipient keys, never addresses, and campaigns hold no
personal data. So the module neither exports nor deletes per user (`privacy: { exports: false, deletes: false }`).

## 12. Limitations

- One recipient per call; no cc, bcc or attachments.
- `sendMail` does not retry: the caller retries `unavailable` with the same `idempotencyKey` (Resend
  keeps keys for 24 hours), or uses `deliverOnce`, which keeps the state between runs.
- Exactly-once ends where the provider's idempotency window ends: a sender that dies after the
  provider accepted a mail and before the outcome was written leaves an `uncertain` claim once
  `uncertainClaimMs` passes; retaking it (`retakeUncertain`) may send that mail twice. No delivery,
  bounce or complaint webhooks yet.
- Campaigns have no personalisation, scheduling or markdown: the body is sent as written.
- Suppression is global per address: no per-list preferences. A person comes back in through a
  module's explicit consent (`liftSuppression`, e.g. a new waitlist sign-up); an operator row is
  removed by hand (`getRecipientKey(address)`).
- Lowercasing the whole address merges `Ada@` and `ada@` (allowed to differ by RFC 5321, never in
  practice); an unsubscribe then covers both.
- The display name in `from` cannot contain commas, semicolons or quotes (no RFC 5322 quoting).
- Address checks are structural (one `@`, a dot in the domain, no separators); the provider has the
  last word.

## Build

`npm run build -w modules/mailing` runs `tsc -p tsconfig.build.json`.
