# @softure-ai/mailing

**Status:** wave 2 · transport (EN-1) · unsubscribe (EN-2) and the delivery ledger with campaigns
(EN-3) come next.

Sends one mail to one recipient through a provider adapter and answers with a typed result, never a
throw. Ported from FIRE_TRACKER `src/lib/mail.ts` (a hand-written Resend `fetch`, plain text only),
with the sender, reply-to, provider and timeout taken from configuration, an HTML body, and a fake
provider for tests.

## 1. What it provides

- `mailing({ from, replyTo, provider, timeoutMs })` for `softure.config.ts`.
- `sendMail(context, mail, options)` in `@softure-ai/mailing/server` and `sendMail(mail, options)` in
  `@softure-ai/mailing/next` (on the registered config). The result is a core `Result`:

  | Result | Meaning | What the caller does |
  | --- | --- | --- |
  | `ok({ id, provider })` | the provider accepted the mail | keep `id` if it needs one |
  | `err("mailing.invalid_input")` | refused before anything left the process | fix the input; never retry |
  | `err("mailing.rejected")` | the provider refused it (4xx: bad address, bad key, key reused with another body) | do not retry the same request |
  | `err("mailing.unavailable")` | provider down (5xx), 408, 429, a busy idempotency key, network, timeout, an answer without an id, no API key | retry later with the same `idempotencyKey` |

- The `MailProvider` contract and `resend()`, the first adapter.
- `@softure-ai/mailing/testing`: `fakeMailProvider()` and `readMailOutbox(file)`.

```ts
import { sendMail } from "@softure-ai/mailing/next";

const result = await sendMail(
  { to: user.email, subject: messages.summary.subject, text, html },
  { idempotencyKey: `weekly-summary:${user.id}:${week}` },
);
if (!result.ok) return result; // a code; the UI shows getMailingErrorMessage(messages, result.error)
```

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

## 2. Installation

```bash
npm install @softure-ai/mailing @softure-ai/core
```

No database, no peer dependencies. The `/testing` entry imports `node:fs`.

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
| `from` | `string` | required | `addr` or `Name <addr>`. Must be on the domain the provider signs (DKIM); with DMARC `adkim=s` exactly that subdomain. |
| `replyTo` | `string` | none | One address for replies; may be on another domain (DMARC does not check it). |
| `provider` | `MailProvider` | required | `resend()`, `fakeMailProvider()` or your own adapter. |
| `timeoutMs` | `number` | `10000` | 1000 to 60000. |

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

Nothing to mount: the module has no routes or pages. Call `sendMail` from server actions, route
handlers (`/next`) or scripts and other modules (`/server`, with `{ config }`).

## 5. Migrations and tables

None in this version. The suppression list (EN-2) and the delivery ledger (EN-3) add the `mailing`
schema.

## 6. Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | with `resend()` and no `apiKey` | Resend API key. Missing at send time: `unavailable` and a log line naming the variable. |

## 7. Switches

None.

## 8. Appearance

No UI.

## 9. Copy

`src/messages/{en,pl}.ts`: `errors.mailing.{invalid_input,rejected,unavailable}`.
`getMailingErrorMessage(messages, code)` returns the copy for a code.

## 10. Hooks

The provider is the extension point (section 3).

**Tests and e2e:** `fakeMailProvider()` keeps accepted mail in `provider.sent` (with the id it
answered) and honours idempotency keys like a real provider. `respond: (message) => ({ status:
"rejected" })` simulates failures. With `outboxFile` it also appends each mail as one JSON line, so a
test in another process (Playwright against `next start`) reads it with `readMailOutbox(file, { to })`.
Without an outbox file it refuses to run under `NODE_ENV=production`, where in-memory mail would
vanish. The example app sets `MAIL_OUTBOX` for its e2e (`examples/next-app/e2e/mailing-transport.spec.ts`).

## 11. GDPR

The module stores nothing. Addresses and content go to the provider only; never to logs or results.

## 12. Limitations

- One recipient per call; no cc, bcc or attachments.
- No retries: the caller retries `unavailable` with the same `idempotencyKey` (Resend keeps keys for
  24 hours). The delivery ledger (EN-3) will make campaign sends exactly-once.
- No unsubscribe links or suppressions yet (EN-2); every mail is sent as given.
- Address checks are structural (one `@`, a dot in the domain, no separators); the provider has the
  last word.

## Build

`npm run build -w modules/mailing` runs `tsc -p tsconfig.build.json`.
