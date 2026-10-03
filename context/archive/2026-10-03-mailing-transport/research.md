# Research: mailing-transport

Input: change.md, backlog-input.md. Depth: medium (a contract other modules build on). Sources:
FIRE_TRACKER `src/lib/mail.ts` (the Resend transport, read through GitHub), `foundation/core`
(module contract, `Result`, config registry), `modules/feature-switches` (package shape),
`modules/auth` (the password-reset sender hook and the example's outbox file), the Resend API
reference (from memory: `POST /emails`, `Idempotency-Key` kept 24 h and up to 256 characters,
errors as `{ statusCode, name, message }`, 409 for idempotency conflicts, 429 for rate limits).

## Current state

- FIRE sends plain text only, through one hand-written `fetch` with the sender, reply-to and
  timeout as constants. Three hard rules there carry over unchanged: never throw (every failure is
  a value), never log or return the address, subject, body or key, and never let `headers` replace
  the envelope or the sender (reserved headers).
- FIRE maps 4xx to `rejected` and 5xx, network, timeout and a response without an id to
  `unavailable`, and never reads the refusal body (providers echo the address in it).
- Module options are parsed by zod in `defineModule`; functions are accepted through `z.custom`
  (auth's `passwordReset.send`), so a provider object can sit in the options.
- Package code reads the app's config through `getSoftureConfig()` from `@softure-ai/core/next`;
  server functions take a context and never read request scope.

## Answers to the roadmap unknowns

1. **HTML templates: plain strings or React email components?** Plain strings. `sendMail` takes
   `text` (required: every mail has a plain-text part) and an optional `html`. An app that writes
   React email components renders them to a string itself; the module stays free of a renderer
   dependency and of `react-dom/server` on the send path. Template helpers can come later without
   changing the contract.
2. **How the fake provider exposes sent mail to e2e tests.** Two ways, one provider:
   `fakeMailProvider()` keeps captured mail in memory (`provider.sent`) for unit tests;
   `fakeMailProvider({ outboxFile })` also appends each mail as one JSON line to a file, which the
   e2e (another process than `next start`) reads with `readMailOutbox(file)`. Same pattern as the
   example's password-reset outbox. The fake honours idempotency keys like a real provider (the same
   key returns the first id and captures nothing new). Without an outbox file the fake refuses to run
   under `NODE_ENV=production`: in memory there it would drop real mail silently.
3. **Which provider errors map to `rejected` vs. `unavailable`.** `rejected` means "retrying the
   same request will not help": 4xx except the retryable ones, including 401/403 (a wrong key is a
   deployment fault, logged with the status). `unavailable` means "try again later": 5xx, 408, 429,
   409 with Resend's `concurrent_idempotent_requests`, network errors, the timeout, a response
   without a message id, a missing API key, and a provider that throws. Only the error `name`
   (an enum) is read from a refusal body, never its message.

## Decisions

- **Result shape.** `Result<SentMail, MailingErrorCode>` from core: `ok({ id, provider })` or
  `err("mailing.invalid_input" | "mailing.rejected" | "mailing.unavailable")`. That is the roadmap's
  `sent | invalid-input | rejected | unavailable` in the repository's result idiom, and the codes
  have copy in the module's messages.
- **Provider contract.** `MailProvider { name, send(message, { signal }) }` returning
  `{ status: "sent", id } | { status: "rejected" | "unavailable", httpStatus? }`. `sendMail` owns
  validation, the timeout (an `AbortSignal` handed to the provider plus a race, so a provider that
  ignores the signal still cannot hang the caller), the catch around a throwing provider and the
  only log line. Providers stay small.
- **Validation.** `to` is exactly one address; `from` (config) is `addr` or `Name <addr>`;
  subject 1 to 998 characters without line breaks; `text` non-empty; `html` optional, non-empty;
  header names are RFC 5322 field names, values have no CR or LF, and the reserved names (`from`,
  `sender`, `to`, `cc`, `bcc`, `reply-to`, `subject`, `return-path`, `content-type`,
  `content-transfer-encoding`, `mime-version`) are refused in any case; the idempotency key is 1 to
  256 visible ASCII characters.
- **Logs.** One line per failure: `mailing: send failed provider=<name> reason=<code> status=<n>`
  (and, for invalid input, the names of the failing fields, never values). Nothing of the mail.
- **API key.** `resend()` reads `RESEND_API_KEY` on every send unless `resend({ apiKey })` is given,
  so `softure.config.ts` loads at build time without the secret.
- **Next adapter.** `sendMail(mail, options)` from `/next` reads the registered config; the server
  function `sendMail({ config }, mail, options)` is what scripts and other modules call.
- **No migration, no dependency on db or security** in this item; EN-2 and EN-3 add tables.

## Risks

- A provider-specific field leaking into the contract would bind every later module to Resend:
  the contract has only mail fields; Resend's names (`reply_to`) live in the adapter.
- Double sends after a timeout: the idempotency key is passed through and documented as the way
  to make a retry safe; the ledger (EN-3) builds keys from campaign × recipient.
