# Research: auth-reset-via-mailing

Input: change.md, backlog-input.md. Depth: light (wiring two existing contracts). Sources:
`modules/auth` (ID-5: `PasswordResetSender`, `deliverPasswordReset`, the Next action that runs it in
`after()`), `modules/mailing` (EN-1: `sendMail` server and `/next`, `fakeMailProvider`,
`readMailOutbox`), the example app (its own outbox sender for reset links, `MAIL_OUTBOX`), the
roadmap's order section (EN-4 owns "the mailing sender wiring in `modules/auth/`").

## Current state

- Auth calls `send(link, user, { expiresAt, locale })` after the response, from the Next action,
  and logs a thrown error without the link. The sender gets no context: no config, no database.
- Mailing's `/next` `sendMail(mail)` reads the registered config (`getSoftureConfig()`); it never
  throws for a failed send, it returns `mailing.invalid_input | rejected | unavailable`.
- The example writes reset links to its own JSON-lines file (`PASSWORD_RESET_OUTBOX`) and
  `e2e/auth-reset.spec.ts` reads links from it.
- Mailing has no mail kinds yet; EN-2 adds kinds and suppressions in parallel.

## Answers to the roadmap unknowns

1. **Where the adapter lives.** In auth, as a new subpath `@softure-ai/auth/mailing`, with
   `@softure-ai/mailing` an optional peer dependency. The roadmap's order section gives the wiring
   to `modules/auth/`; the copy (auth's own words) stays in auth's dictionaries next to the reset
   pages; mailing stays free of any knowledge of auth; and EN-2 owns `modules/mailing/` in
   parallel. An app without mailing never loads the subpath, so it never needs the package.
2. **Link expiry copy per locale.** A duration, not a clock time: "works for {ttlMinutes}
   minutes", the same words the request page already shows (`forgotPassword.sent`). A clock time
   would need the reader's time zone, which the app does not know; the duration is the configured
   `passwordReset.ttlMinutes`, so mail and page always agree.

## Decisions

- **Config access.** The sender reads the registered config (`getSoftureConfig()`) when it runs,
  the way every package-shipped action does; the config cannot be passed in, since the sender sits
  inside it.
- **Copy.** `resetMail.{subject, greeting, intro, action, expiry, ignore}` in `authMessages.en/pl`,
  overridable through `auth({ messages })`. Text = the paragraphs with the bare link; HTML = the
  same paragraphs with the link as an anchor, every value HTML-escaped. The email address is not
  repeated in the body.
- **Failure.** A `mailing.*` error becomes a thrown `Error` naming the code (never the address or
  link), so auth's existing `after()` logging reports it; mailing has already logged its line.
- **Transactional.** No unsubscribe header, no kind (EN-1 has none). The EN-2 thread was told that
  reset mail must stay transactional when kinds arrive.
- **Example.** The example's own reset sender goes: `mailingResetSender()` replaces it, and
  `readResetLinks` in `e2e/outbox.ts` reads links from the mail outbox, so the ID-5 scenarios now
  run through mailing too.

## Risks

- A template override that drops `{link}` would send a mail without the link: the link is never
  part of a translatable string; the code places it.
- HTML injection through an override or the origin: every value is escaped.
