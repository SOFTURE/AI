# Research: attachments in mailing (issue #655)

## Current state (master 623319f)

- `OutgoingMail` (`src/contract.ts`): `to`, `subject`, `text`, `html?`, `headers?`, `replyTo?`, `kind?`.
  `validateMail` (`src/server/validate-mail.ts`) parses it with zod and returns field names only on failure.
- `ProviderMessage` is what a provider receives; `composeMessage` in `send-mail.ts` builds it; `previewMail`
  returns it (the API dry run); `softure-mail` prints it with `printPreview` (`src/cli/run.ts`).
- The module's only log line is `logFailure` in `send-mail.ts`: provider, code, HTTP status, field names, a fixed
  cause. There is no success log. The delivery ledger (`mailing.deliveries`) stores scope, recipient key, kind and
  outcome, nothing of the mail.
- `deliverOnce` validates the mail before claiming (`deliveries.ts:170`), then calls `sendMail`.
- Queued deliveries (`src/jobs/delivery-job.ts`): the job payload holds the scope and the app's ids;
  `buildMail` rebuilds the mail from the app's data on every attempt. The mail never enters the payload.
- `fakeMailProvider` captures `ProviderMessage`s in memory and, with `outboxFile`, as JSON lines that
  `readMailOutbox` parses with a strict-shape zod schema.
- Resend `POST /emails` accepts `attachments: [{ filename, content (base64), content_type }]`; the whole email,
  after base64 encoding, must stay under 40 MB.

## Findings

- Base64 grows content by 4/3, so the raw total must stay well under 30 MB to fit 40 MB on the wire with the
  bodies. 28,000,000 raw bytes encode to about 37.3 MB.
- A custom `MailProvider` written before this change ignores a new `attachments` field and would send the mail
  without its files. The contract needs an explicit opt-in.
- A filename is chosen by the app and often carries a person's name or an invoice number: personal data, like the
  subject, which the log never carries.
- The jobs design already answers the queue question: attachments come from `buildMail`, loaded by reference from
  the app's own storage on each attempt; the payload can stay ids only. A guard can refuse binary data in an
  `enqueueDelivery` payload.
