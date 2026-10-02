# @softure-ai/mailing

**Status:** wave 2 · not implemented · depends on: core, db, security

- **Transport:** provider adapter (`resend()` first), timeout, `Idempotency-Key`, protection of
  reserved headers, result `invalid-input | rejected | unavailable`; plain text + HTML.
- **Unsubscribe:** HMAC signature, RFC 8058 headers (`List-Unsubscribe(-Post)`), footer, a one-click
  endpoint and an unsubscribe page.
- **Delivery ledger**, *exactly-once* (claim → sent/rejected), for campaigns and lifecycle mail.
- Campaigns from a content file, DNS checks (SPF/DKIM/DMARC).

**Tables:** `mailing.deliveries`, `mailing.campaigns`, `mailing.suppressions`*

**Source in FIRE_TRACKER:** `src/lib/{mail,mail-dns,unsubscribe-link,unsubscribe-footer,list-mail,list-send,account-send,account-mail-content}.ts`,
`src/db/account-mail.ts`, `src/app/api/wypisz/`, `src/app/wypisz/`, `src/app/actions/do-unsubscribe.ts`,
`scripts/{lista-*,konta-*,mail-dns-check,mail-test}*`.

**Improvements:** sender, templates and mail kinds come from configuration. Campaigns run over a regular
database connection instead of deployment-specific remote scripts.

\* new
