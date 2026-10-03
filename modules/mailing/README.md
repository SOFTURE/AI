# @softure-ai/mailing

**Status:** wave 2 · transport (EN-1) and unsubscribe (EN-2) · the delivery ledger with campaigns
(EN-3) comes next.

Sends one mail to one recipient through a provider adapter and answers with a typed result, never a
throw. Ported from FIRE_TRACKER `src/lib/mail.ts` (a hand-written Resend `fetch`, plain text only),
with the sender, reply-to, provider and timeout taken from configuration, an HTML body, and a fake
provider for tests. List mail gets signed one-click unsubscribe (RFC 8058) and a suppression list,
ported from FIRE_TRACKER `src/lib/unsubscribe-*.ts` and `/wypisz`.

## 1. What it provides

- `mailing({ from, replyTo, provider, timeoutMs })` for `softure.config.ts`.
- `sendMail(context, mail, options)` in `@softure-ai/mailing/server` and `sendMail(mail, options)` in
  `@softure-ai/mailing/next` (on the registered config). The result is a core `Result`:

  | Result | Meaning | What the caller does |
  | --- | --- | --- |
  | `ok({ id, provider })` | the provider accepted the mail | keep `id` if it needs one |
  | `err("mailing.invalid_input")` | refused before anything left the process | fix the input; never retry |
  | `err("mailing.rejected")` | the provider refused it (4xx: bad address, bad key, key reused with another body) | do not retry the same request |
  | `err("mailing.unavailable")` | provider down (5xx), 408, 429, a busy idempotency key, network, timeout, an answer without an id, no API key; for list mail also no unsubscribe secret or an unreadable suppression list | retry later with the same `idempotencyKey` |
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
  scripts, bounce or complaint handlers), `unsubscribe(ctx, token, source)`, `buildUnsubscribeLinks`,
  `getRecipientKey`, and the footer and header helpers.
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
the database and answers 200 (recorded, also again), 400 (link does not verify) or 500 (database
failure, so the client retries); a GET redirects to the page. The whole link is a credential: it is
never logged.

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
    return { status: response.status >= 500 || response.status === 429 ? "unavailable" : "rejected", httpStatus: response.status };
  },
};
```

A provider receives a validated `ProviderMessage` (`from`, `to`, `replyTo`, `subject`, `text`, `html`,
`headers`, `idempotencyKey`, nulls for what is absent). A throw reads as `unavailable`.

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

The health check (`checkSuppressionsTable`) runs `select 1 from mailing.suppressions limit 0`.
The delivery ledger (EN-3) adds its tables to the same schema.

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

`src/messages/{en,pl}.ts`: `errors.mailing.{invalid_input,rejected,unavailable,suppressed}`,
`footer.{text,htmlLead,htmlLink}` (the list-mail footer, in the app's locale) and
`unsubscribe.*` (the page). `getMailingErrorMessage(messages, code)` returns the copy for a code;
override any text with `mailing({ messages: { en: { footer: { text: "…" } } } })`.

## 10. Hooks

The provider is the extension point (section 3).

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
mail. So the module neither exports nor deletes per user (`privacy: { exports: false, deletes: false }`).

## 12. Limitations

- One recipient per call; no cc, bcc or attachments.
- No retries: the caller retries `unavailable` with the same `idempotencyKey` (Resend keeps keys for
  24 hours). The delivery ledger (EN-3) will make campaign sends exactly-once.
- Suppression is global per address: no per-list preferences and no resubscribe flow yet. To let a
  person back in, delete their row (`getRecipientKey(address)`).
- Lowercasing the whole address merges `Ada@` and `ada@` (allowed to differ by RFC 5321, never in
  practice); an unsubscribe then covers both.
- The display name in `from` cannot contain commas, semicolons or quotes (no RFC 5322 quoting).
- Address checks are structural (one `@`, a dot in the domain, no separators); the provider has the
  last word.

## Build

`npm run build -w modules/mailing` runs `tsc -p tsconfig.build.json`.
