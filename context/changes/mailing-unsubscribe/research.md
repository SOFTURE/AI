# Research: mailing-unsubscribe

Input: change.md, backlog-input.md. Depth: medium (deliverability and compliance; every list mail
depends on it). Sources: FIRE_TRACKER `src/lib/unsubscribe-link.ts`, `src/lib/unsubscribe-footer.ts`,
`src/app/api/wypisz/route.ts`, `src/app/wypisz/{page,unsubscribe-form}.tsx`,
`src/app/actions/do-unsubscribe.ts` (read through GitHub), `modules/mailing` (EN-1),
`modules/feature-switches` and `modules/auth` (table, health check, Next adapter shape), RFC 8058
and RFC 2369 (from memory: the `List-Unsubscribe` URI must be HTTPS for one-click,
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`, the POST carries no cookies and must not need a
session; both headers must be covered by the DKIM signature, which the provider does).

## Current state (FIRE)

- `t = HMAC-SHA256(secret, "wypisz:" + signupRowId)`, hex; links `?u=<id>&t=<sig>` to a page
  (`/wypisz`) and a one-click route (`/api/wypisz`). Verification checks the format first, then
  `timingSafeEqual`; it never throws. A secret shorter than 32 characters counts as missing. The
  secret cannot rotate: a change kills every link already sent ("a list of keys would be the way").
- One footer and one header pair for all list mail, under the RFC 3676 signature separator `-- `.
- The page never unsubscribes on GET (mail scanners open links); a button POSTs. The one-click route
  answers 200 for valid, invalid and unknown links, 500 on a database failure, and redirects GET
  (303) to the page: clients without RFC 8058 open the header URL in a browser, and a 405 would put
  the token in proxy access logs.
- Suppression is a column on the waitlist table: only waitlist mail can be suppressed.

## Answers to the roadmap unknowns

1. **Secret rotation.** Yes, accept old and new. `MAILING_UNSUBSCRIBE_SECRET` signs and verifies;
   `MAILING_UNSUBSCRIBE_SECRET_PREVIOUS` (optional) only verifies. Rotation: move the current value
   to `_PREVIOUS`, set a new current one; links in mail signed with the old key keep working for as
   long as `_PREVIOUS` holds it. Both must be at least 32 characters; a shorter one counts as
   missing (a guessable key lets anyone mint links). Read from the environment on every use, like
   `RESEND_API_KEY`, so the configuration loads at build time without the secret.
2. **Per kind or global.** Global per address. An unsubscribe stops every list mail of the app;
   transactional mail still arrives. FIRE promises exactly that ("no message of any kind"), it is
   the reading of RFC 8058 and of anti-spam law that cannot go wrong, and it keeps the link free of a
   kind the signature would have to cover. Per-list preferences can come later as a separate,
   opt-in table without changing the link.
3. **Footer in HTML vs. text.** Both. Text: under the `-- ` separator, one copy line and the page
   URL. HTML: a paragraph with a link, inserted before the last `</body>` when the HTML has one,
   appended otherwise. Copy from the module's messages in the app's locale.

## Decisions

- **What the link identifies.** No recipient table exists (FIRE signed a waitlist row id). The link
  carries `r = base64url(sha256(lowercased, trimmed address))` and `t = base64url(HMAC-SHA256(secret,
  "softure.mailing.unsubscribe.v1:" + r))`, 43 characters each. The address never appears in a URL
  (access logs, browser history, referrers), and the suppression table stores only `r`: the module
  still holds no plain addresses. The prefix separates this signature from anything else the same
  key might ever sign; changing it would void sent links, like changing the key.
- **Table.** `mailing.suppressions (recipient_key text primary key, source text, created_at)`;
  `recipient_key` checked to the 43-character base64url shape, `source` one of `one-click`, `page`,
  `operator`. Insert with `ON CONFLICT DO NOTHING`: a second unsubscribe keeps the first date.
- **Kinds.** `OutgoingMail.kind`, default `transactional`. Any other kebab-case name (1 to 64
  characters, e.g. `newsletter`) is list mail. The kind is not stored (suppression is global); it
  exists so callers state intent and EN-3 can key campaigns by it.
- **sendMail order for list mail.** validate → secret present (else `unavailable`, log names the
  variable) → suppressed? (`suppressed`; a database failure is `unavailable`, fail closed) → links,
  headers and footer → provider. A list mail whose `headers` already carry `List-Unsubscribe` or
  `List-Unsubscribe-Post` is `invalid_input`: the module owns those two for list mail.
- **Database handle.** `MailContext` gains an optional `db`. Transactional mail needs none (EN-4
  keeps calling `sendMail({ config }, …)`); list mail without `db` throws: that is a wiring bug.
  `/next` always passes the shared handle. The module now has `dbSchema: "mailing"`, so an app that
  lists `mailing()` needs a database (it already has one wherever auth runs).
- **One-click route.** `POST` reads `r` and `t` from the URL (the body is the fixed
  `List-Unsubscribe=One-Click` and proves nothing), verifies before touching the database, answers
  200 on success, 400 for an invalid link, 500 on a database failure (the client may retry; 200 would
  claim an opt-out that did not happen). `GET` redirects 303 to the page with the same query.
  `Cache-Control: no-store` everywhere.
- **No IP rate limit on the one-click route.** Mail providers POST from a few shared addresses
  (Gmail's servers act for millions of people), so a per-IP bucket would refuse real unsubscribes.
  Input is validated by shape and signature before any database access, and the only write is an
  idempotent insert keyed by the signed value. Recorded as a deliberate exception to "public
  endpoints are rate-limited".
- **Page.** A server component: with `r` and `t` it shows a lead and a button (a plain form posting
  a server action, no client JavaScript needed); the action verifies, records and redirects to
  `?status=done`; an invalid link redirects to `?status=invalid`; a database failure re-renders the
  form with an error (`?status=failed` with the same `r` and `t`). The page does not check the
  signature on open. `referrer` policy `same-origin`, as on auth's reset page.
- **Exports for EN-3 / EN-5.** `/server`: `isSuppressed(ctx, address)`, `suppressRecipient(ctx,
  address, source)`, `unsubscribe(ctx, { r, t }, source)`, `getRecipientKey(address)`,
  `buildUnsubscribeLinks(config, address, env)`, `checkSuppressionsTable`; root: the `suppressions`
  Drizzle table. A campaign sends each recipient with `kind` and gets headers, footer and
  suppression for free.

## Risks

- A wrong header or a link that 404s on production hurts deliverability: unit tests pin the exact
  headers and footer, the e2e drives the header URL and the footer URL against `next start`.
- Lost secret = dead links: documented in the README; rotation keeps the previous key.
- Lowercasing the whole address merges `Ada@` and `ada@` (case-sensitive local parts are allowed by
  RFC 5321 but unused in practice); an unsubscribe then covers both, which errs on the safe side.
