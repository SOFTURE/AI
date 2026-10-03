# Research: waitlist

Sources: `modules/mailing` (EN-1 transport, EN-2 suppressions and links, EN-3 `deliverOnce`),
`modules/privacy` (EN-7 contributors, EN-8 `recordConsent`), `modules/auth` (public actions,
`after()`, rate limit buckets, `RegisterForm` consent checkbox), `modules/mcp-access` (a module with
a table, a contributor, localized labels in options), `docs/01-module-assessment.md` row 5 and the
module README stub. FIRE_TRACKER is outside this session's scope; the roadmap baseline says FIRE
embeds the form in a domain component and keeps scopes as CHECK constraints.

## 1. What exists

- `deliverOnce(ctx, { scope, mail })` sends at most once per scope and recipient and returns
  `sent | rejected | done | in-flight | retry-later`. List mail (any kind but `transactional`) gets
  mailing's signed unsubscribe footer and RFC 8058 headers, needs `MAILING_UNSUBSCRIBE_SECRET`, and
  is refused with `mailing.suppressed` after an unsubscribe. Unsubscribing covers every list kind.
- `recordConsent(ctx, { subject: { email }, purpose, granted, document?, source })` stores the
  email's SHA-256 key, never the address, stamps the configured document version, and throws when
  privacy is not enabled. `hasConsent` is false for a withdrawn consent and for an older version.
  Privacy deletes an account's email consents with the account.
- Auth's public actions identify the client (`identifyClient`), count buckets before any work
  (`consumeRateLimit`), assert their buckets once per config, and run mail in `after()` so the
  answer never depends on the mail.

## 2. Unknowns from the roadmap

1. **DB enum or validated text?** Validated text. Scopes and placements are the app's, they change
   with the app's copy, and an enum or CHECK list would need a module migration per app. The table
   checks the shape (kebab-case, at most 64 characters, 1 to 16 scopes, no NULLs); the module checks
   membership against the config. A scope id is also the consent purpose in the ledger, so it shares
   privacy's purpose shape.
2. **Double opt-in?** Not now (out of scope). The welcome mail is list mail with an unsubscribe
   link, and the ledger has the consent; a confirmation step can be an option later without a
   schema change (a `confirmed_at` column).
3. **Placement analytics?** The sign-up stores the placement of its first form; `listSignups`
   returns it. The analytics roadmap reads it from there.

## 3. Repeat sign-ups

The answer of the action is the same for a new and a known address (no enumeration). Scopes widen:
the stored set becomes the union in config order. A consent is recorded for each requested scope
the ledger does not currently grant (new, withdrawn, or granted against an older document version),
so re-submitting refreshes outdated evidence and adds nothing otherwise. The sign-up and the
consents share one transaction; a concurrent first sign-up of the same address loses the insert
race and continues as a repeat sign-up (`ON CONFLICT DO NOTHING`, then `SELECT … FOR UPDATE`).
