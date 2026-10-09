# @softure-ai/waitlist

Collects sign-ups before a product opens: one row per email address with the consent scopes the
person checked, evidence of each consent in privacy's ledger, a welcome mail sent once through
mailing, and a standalone form. Built from FIRE_TRACKER's waitlist (`src/db/waitlist.ts`,
`src/app/actions/{do-waitlist,waitlist,waitlist-contract}.ts`,
`src/lib/{waitlist-consent,waitlist-placement,welcome-mail}.ts`, `src/components/consent-checkbox.tsx`
and the form inside `calculator-lista.tsx`), with the scopes and placements moved from CHECK
constraints into the app's configuration and the form out of the domain component.

## 1. What it provides

- The table `waitlist.signups`: the address (trimmed, lowercased, unique), the granted scopes in
  the config's order, the placement of the first sign-up, the locale, its timestamps and, with
  double opt-in, the request that waits for its confirmation link.
- **Double opt-in as an option** (`doubleOptIn`, off by default). A sign-up then waits for the link
  in a confirmation mail: until it is used, nothing is recorded, no opt-out is lifted, no list mail
  goes out and `listSignups` leaves the address out. The link applies the request and sends the
  welcome mail.
- **Consent scopes from configuration.** The app declares them in `waitlist({ scopes })`, with
  labels per locale, which ones are required and the legal document each refers to. The table
  checks only their shape; nothing app-specific is hard-coded in a migration.
- **Repeat sign-ups widen, never narrow.** Signing up again adds the newly checked scopes and keeps
  the earlier ones. The answer is the same for a new and a known address.
- **Consent evidence in privacy.** Each requested scope the ledger does not currently grant (never
  given, withdrawn, or given to an older version of its document) is recorded with
  `recordConsent` (source `waitlist`, the document's version), in the sign-up's transaction.
- **A welcome mail after the response**, through mailing's delivery ledger: at most once per
  sign-up (scope `waitlist.welcome:<id>`), as list mail of kind `waitlist`, so it carries mailing's
  unsubscribe link and RFC 8058 headers and is never sent to an address that unsubscribed. Text
  and HTML; the app can render the HTML of both mails with its own template (`mailTemplate`).
- **The ledger follows unsubscribes.** `withdrawWaitlistConsents`, wired as mailing's
  `onUnsubscribed`, records a withdrawal of every scope the address still grants, in the opt-out's
  transaction. Only a sign-up confirmed through its link (double opt-in) lifts the address's own
  opt-out (`liftSuppression`), and after one it stores exactly the scopes checked this time. Without
  double opt-in, a sign-up of an address that unsubscribed changes nothing, so typing someone
  else's address cannot put them back on the list.
- **A rate-limited public action**: bucket `waitlist` per client, `waitlist-email` per address.
- `<Waitlist placement="hero" />` (`/next`), the form wired in one line, and `WaitlistForm` (`/ui`)
  with slots, `unstyled` and messages for an app that composes its own.
- **The acquisition channel per sign-up** (`resolveChannel`, e.g. analytics' `getChannel`), kept
  with the first sign-up and counted by `countSignupsByChannel`.
- **The person's own unsubscribe link in the success answer**, when the app asks for it
  (`unsubscribeLinkOnSuccess`).
- **An import of the list an app kept before** (`importSignups`, the `import-signups` ops script):
  rows with their original time, id and channel, consents at the time they were given, and the
  opt-outs of who unsubscribed (section 10, "Moving an existing list").
- Export and deletion of the account's sign-up (`@softure-ai/privacy`), a health check for
  `GET /api/health`, and `listSignups` for a launch mail.

## 2. Installation

```bash
npm install @softure-ai/waitlist @softure-ai/mailing @softure-ai/privacy @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm zod
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`. The module depends on `security`,
`mailing` and `privacy` (which needs `auth`); a configuration without them fails at startup.

## 3. Configuration

```ts
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { mailing, resend } from "@softure-ai/mailing";
import { privacy } from "@softure-ai/privacy";
import { cloudflareIp, security } from "@softure-ai/security";
import { waitlist, WAITLIST_RATE_LIMIT_BUCKETS } from "@softure-ai/waitlist";
import { withdrawWaitlistConsents } from "@softure-ai/waitlist/server";
import { en } from "./messages/en";
import { pl } from "./messages/pl";

// in defineSoftureConfig({ modules: [...] }):
security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...WAITLIST_RATE_LIMIT_BUCKETS } }),
auth({ ... }),
// An unsubscribe withdraws the waitlist's consents (section 10):
mailing({ from: "Acme <hello@mail.acme.com>", provider: resend(), onUnsubscribed: withdrawWaitlistConsents }),
privacy({ documents: [{ id: "privacy-policy", version: "2026-10-01" }] }),
waitlist({
  scopes: [
    { id: "launch", required: true, document: "privacy-policy", label: { en: en.waitlist.launch, pl: pl.waitlist.launch } },
    { id: "newsletter", label: { en: en.waitlist.newsletter, pl: pl.waitlist.newsletter } },
  ],
  placements: ["hero", "footer"],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `scopes` | `{ id, required?, document?, label: { en, pl? } }[]`, 1 to 16 | required | The checkboxes, in order. `id` is kebab-case (at most 64 characters) and becomes the consent purpose in `privacy.consents`. `required` scopes must be checked; without any required scope, at least one must be. `document` names a document of `privacy({ documents })`, whose version is recorded with the consent. |
| `placements` | kebab-case `string[]` | `["default"]` | Where the app embeds the form. Each sign-up stores the placement of its first form. |
| `welcomeMail` | `boolean` | `true` | Sends the welcome mail (with double opt-in, after the confirmation). Off, the app sends its own (or none). |
| `doubleOptIn` | `boolean` or `{ expiresInHours? }` | `false` | A sign-up counts only after the link in a confirmation mail is used. `true` keeps the link working for 168 hours (7 days); `expiresInHours` sets 1 to 720. Section 10. |
| `mailTemplate` | `(mail) => string` | — | Renders the HTML body of the welcome and confirmation mails (below). Without it, a plain HTML body built from the same copy. |
| `onJoined` | `(event, ctx) => void \| Promise<void>` | — | Called in the sign-up's transaction when a sign-up counts for the first time, e.g. to count it in the analytics funnel. Section 10. |
| `rewriteConfirmationLink` | `(path, { config }) => string \| Promise<string>` | — | Rewrites the confirmation link's path, e.g. to keep the analytics channel tag through the mail. Section 10. |
| `resolveChannel` | `({ config }) => string \| null \| Promise<…>` | — | The request's acquisition channel, called by the join action in the request's scope, e.g. `() => getChannel()` from `@softure-ai/analytics/next`. Stored with a first sign-up (1 to 64 visible ASCII characters); a throw or another value is logged by kind and the sign-up goes on without one. |
| `unsubscribeLinkOnSuccess` | `boolean` | `false` | Answers a sign-up with the person's own unsubscribe page link (`unsubscribeUrl`), which `WaitlistForm` shows under the success notice. Never with double opt-in's `confirmation_sent`. Needs `MAILING_UNSUBSCRIBE_SECRET` (the first sign-up checks it). Only the request that created the sign-up gets the link: a known and a suppressed address are answered alike, without it, so nobody receives the link of an address they typed but do not own. The link's absence tells a repeat submitter the address was already known; turn it on only when the product asks people to keep that link. |
| `routes` | `{ confirm? }` | `{ confirm: "/waitlist/confirm" }` | The path of the confirmation page, when the app mounts it elsewhere. |
| `messages` | partial `en` / `pl` | — | Copy overrides, the welcome mail's subject and text included. |

`WAITLIST_RATE_LIMIT_BUCKETS` is `{ waitlist: { limit: 10, windowMinutes: 15 }, "waitlist-email": { limit: 3, windowMinutes: 60 } }`.
Every attempt counts per client before anything is checked; the per-address bucket stops one
address from being signed up over and over. The first sign-up checks once that both buckets are
configured and that every scope's document is declared, and throws naming what is missing.

The welcome mail is list mail, so mailing needs `MAILING_UNSUBSCRIBE_SECRET` (mailing README §6);
without it the mail is refused and the sign-up still succeeds. The confirmation mail is
transactional and needs no secret.

Both mails carry a text body and an HTML body built from the same copy: each paragraph (blocks
split by a blank line) escaped in `<p>`, and in the confirmation mail the link as an anchor
labelled `confirmationMail.action`. Mailing adds its unsubscribe footer to both bodies of the
welcome mail (inside `<body>` when the HTML is a whole document). To use the app's own layout, pass
a template; it gets `kind` (`welcome` or `confirmation`), `locale`, `subject`, `paragraphs` (plain
text: escape them with `escapeHtml`), `body` (the default HTML, safe to wrap) and, for the
confirmation mail, `action: { href, label }`:

```ts
import { escapeHtml, waitlist, type WaitlistMailTemplate } from "@softure-ai/waitlist";

const mailTemplate: WaitlistMailTemplate = (mail) =>
  `<!doctype html><html lang="${mail.locale}"><body><h1>${escapeHtml(mail.subject)}</h1>${mail.body}</body></html>`;

waitlist({ scopes: [...], mailTemplate });
```

The template runs when the mail is sent, after the response to the form or the link. One that
throws, or returns blank HTML (the module then throws an error naming `mailTemplate`), sends no
mail: the sign-up stands, and the error reaches the app's logs.

## 4. Mounting

The form posts to a server action that ships in the package. Embed it in any server component:

```tsx
import { Waitlist } from "@softure-ai/waitlist/next";

<Waitlist placement="hero" />
// a label with a link, in place of the config's text:
<Waitlist placement="footer" consentLabels={{ launch: <>Tell me when it opens (<a href="/legal/privacy">privacy policy</a>).</> }} />
```

With double opt-in, mount the confirmation page (the link in the mail opens it):

```tsx
// app/waitlist/confirm/page.tsx
export { ConfirmSignupPage as default } from "@softure-ai/waitlist/next";
```

Opening the page changes nothing (mail scanners open links): it shows a button that posts
`confirmSignupAction`, which confirms and redirects back with `?status=done` (or `invalid`,
`expired`, `limited`, `failed`; the last two keep the link for a retry).

An app that composes its own form passes `joinWaitlistAction` (`/next`) to `WaitlistForm` (`/ui`)
with the scopes it prepared (`{ id, label, required }`), the placement and the messages.

Server functions, for scripts and other hosts (`@softure-ai/waitlist/server`):
`joinWaitlist(ctx, { email, scopes, placement, clientKey })` returns
`Ok<{ status: "joined", signup, isNew, recordedScopes }>` (applied at once),
`Ok<{ status: "confirmation_required", signup, isNew, token, expiresAt }>` (double opt-in: pass
`signup` and `token` to `deliverConfirmationMail(ctx, signup, token)`, never to the client),
`Ok<{ status: "suppressed" }>` (no double opt-in and the address is on mailing's suppression list:
nothing was written; answer as for `joined`, so the answer does not tell who unsubscribed) or
`Err<waitlist.email_invalid | waitlist.consent_required | waitlist.form_invalid | security.rate_limited>`;
`confirmSignup(ctx, { token, clientKey })` returns `Ok<{ signup, recordedScopes, isFirstConfirmation }>`
or `Err<waitlist.confirmation_invalid | waitlist.confirmation_expired | security.rate_limited>`;
`pruneUnconfirmedSignups(ctx)` deletes sign-ups whose link expired unused (for a scheduled job;
returns the count); `getConfirmationLink(config, token)` builds the link;
`withdrawWaitlistConsents(event, ctx)` is mailing's `onUnsubscribed` handler (section 10);
`deliverWelcomeMail(ctx, signup)` returns mailing's `DeliveryOutcome` or `{ status: "skipped" }`;
`getSignup(ctx, email)` (confirmed or not, see `confirmedAt`); `listSignups(ctx, { scope?, placement? })`,
the confirmed sign-ups oldest first. A launch mail is
a loop over `listSignups(ctx, { scope: "launch" })` with mailing's `deliverOnce` (or a mailing
campaign): unsubscribed addresses are refused there.

## 5. Migrations and tables

`migrations/0001_create_signups.sql` creates `waitlist.signups` and the function
`waitlist.is_scope_list(text[])` its check uses; `0002_add_confirmation.sql` adds the double opt-in
columns, with checks that an unconfirmed row has a pending request and a pending request has a link;
`0003_add_channel.sql` adds the channel:

| Column | Meaning |
| --- | --- |
| `id` | `uuid`, the sign-up; the welcome mail's delivery scope names it. |
| `email` | Trimmed and lowercased (a CHECK), unique (`signups_email_key`). |
| `scopes` | `text[]`: 1 to 16 distinct kebab-case ids of at most 64 characters, in the config's order. GIN index for lists by scope. |
| `placement` | Kebab-case, the first sign-up's form. |
| `locale` | The app's locale at the first sign-up: the welcome mail's language. |
| `created_at`, `updated_at` | The first sign-up and the last change. |
| `confirmed_at` | When the sign-up first counted (at once without double opt-in); NULL while its first request waits for the link. Rows from before migration 2 are confirmed at `created_at`. |
| `pending_scopes` | The scopes of a request that waits for its link (a first sign-up, or more scopes later), or NULL. |
| `channel` | The first sign-up's acquisition channel (1 to 64 visible ASCII characters, a CHECK), or NULL. Partial index over confirmed rows for the per-channel counts. |
| `confirmation_token_hash`, `confirmation_expires_at` | sha256 (hex, unique) of the latest link's token and its expiry; set together. A used link keeps its hash until the next request replaces it, so a second click answers "confirmed". |

Scope ids are validated text, not an enum or a CHECK list: they are the app's, and a list in the
database would need a module migration for every app's change of copy.

## 6. Environment variables

None of its own. The welcome mail, `unsubscribeLinkOnSuccess` and an import with unsubscribed rows
need mailing's `MAILING_UNSUBSCRIBE_SECRET`; the confirmation link is a random token stored as a
hash, so double opt-in needs no secret.

## 7. Switches

None. `welcomeMail: false` turns the mail off; `doubleOptIn` is an option, not a switch, because
turning it off while requests wait would leave them unconfirmed (a later sign-up of the same
address applies them).

## 8. Appearance

`WaitlistForm` uses the `@softure-ai/ui` primitives (TextField, Checkbox, FormError, Button) and
takes `classNames` for its slots `root`, `form`, `scopes`, `notice` and `unsubscribe` (the
paragraph with the unsubscribe link), or `unstyled`. `Waitlist`
passes both through.

## 9. Copy

`waitlistMessages` (`en`, `pl`): `form` (field label, button, pending text, the confirmation,
with double opt-in `confirmationSent`, and `unsubscribeHint` with `unsubscribeLink` for the link
of `unsubscribeLinkOnSuccess`), `welcomeMail` (subject and text; mailing appends the
unsubscribe footer), `confirmationMail` (subject, text and `action`, the link's label in the HTML
body; in the text body the link follows the text), `confirm`
(the confirmation page: its states and button) and `errors`. Override
them with `waitlist({ messages: { pl: { welcomeMail: { subject: "…" } } } })`. Scope labels are
the app's, in `scopes[].label` or `consentLabels`.

## 10. Hooks

`onJoined(event, ctx)` runs when a sign-up counts for the first time, inside its transaction (`ctx`
is the module context with the transaction as `db`, like auth's `onRegistered`): a new sign-up
without double opt-in (`via: "join"`), or the first use of its link with it (`via: "confirmation"`).
`event.signup` is the sign-up as it stands. A repeat request that only widens the scopes, a second
link, or a link used again does not call it: the consent ledger records those. An error the hook
throws rolls the sign-up back (the form or the confirmation page answers the generic error, and the
link stays usable), so a hook that must never refuse a sign-up catches its own errors, as
analytics' `countFunnelStep` does:

```ts
import { countFunnelStep, tagRedirect } from "@softure-ai/analytics/next";

waitlist({
  scopes: [...],
  doubleOptIn: true,
  // Counts each sign-up as the funnel's `waitlist` step (a `server` step) under the visit's channel.
  onJoined: countFunnelStep("waitlist"),
  // With double opt-in the sign-up counts on the confirmation page, opened from a mail: the link
  // carries the channel of the form's page so the count keeps it.
  rewriteConfirmationLink: tagRedirect,
}),
```

`rewriteConfirmationLink(path, { config })` gets the link's path (the confirm route with its
token) where the confirmation mail is built: in the join action, after the response, where Next
still exposes the request's headers. Its result is used only when it is the confirm route on this
app with the same token; anything else, or an error, mails the module's own link with a log line.
`resolveConfirmationLink(config, token)` from `/server` gives the link as it will be mailed.

`joinWaitlist` also returns `isNew` and `recordedScopes` (and `confirmSignup` returns
`isFirstConfirmation`) for an app that reacts to every request in its own server code.

The waitlist plugs into mailing's `onUnsubscribed` with `withdrawWaitlistConsents`. Mailing's
opt-out covers every list mail and its link names only the recipient key, so the handler withdraws
each declared scope whose latest record grants it (`granted: false`, source `unsubscribe`, subject
`{ emailKey }`); a repeated unsubscribe adds nothing. Without it, the ledger keeps showing granted
consents for an address that unsubscribed, and a later sign-up's lift erases the only record of
the opt-out. If the app has other mail consents, compose: `onUnsubscribed: async (event, ctx) => {
await withdrawWaitlistConsents(event, ctx); await withdrawMine(event, ctx); }`.

Only a sign-up whose link was used undoes an opt-out. Without double opt-in nothing proves that
whoever typed the address controls it, so `joinWaitlist` of an address on mailing's suppression
list (any source: the person's own `page` or `one-click` opt-out, or an operator's row for a bounce
or a complaint) writes nothing, records no consent, calls no `onJoined` and answers
`{ status: "suppressed" }`; the join action answers it exactly like an address already on the list
(`status: "ok"`, never an `unsubscribeUrl`) and sends no mail. An app that wants people who
unsubscribed to come back through the form turns on double opt-in: `confirmSignup` calls mailing's
`liftSuppression` in its transaction, which removes an opt-out the person made themselves (never an
operator's). When it removed one, the sign-up's scopes become the ones checked now instead of the
union, because the opt-out withdrew all of them.

### Double opt-in

With `doubleOptIn` on, `joinWaitlist` stores the request on the row (`pending_scopes`) with a new
single-use link that replaces any earlier one, and the join action mails it as transactional mail
(it must reach an address that opted out and signs up again). Nothing else happens until the link
is used: no consent row, no lift, no welcome mail, and `listSignups` leaves a sign-up that never
counted out. A repeat request on an unconfirmed sign-up replaces its scopes; on a confirmed one it
waits beside the granted scopes, which stay until its link is used. `confirmSignup` applies the
request as above, records the consents (with the document version in force at confirmation), sets
`confirmed_at` the first time, and the confirm action sends the welcome mail. Consents are recorded
only at confirmation: the ledger is insert-only, and a row written before would claim a consent
nobody proved. Run `pruneUnconfirmedSignups(ctx)` from a scheduled job to delete sign-ups whose link
expired unused; until then they count nowhere, and a new sign-up of the address reuses the row.

### Moving an existing list

An app that kept its own list imports it once, before it switches its form to the module.
`importSignups(ctx, rows)` from `/server` takes rows of `{ email, scopes, placement, locale,
signedUpAt, id?, confirmedAt?, consentedAt?, documentVersions?, channel?, unsubscribedAt? }`
(times as `Date`); the `import-signups` ops script from `/scripts` reads the same rows from a JSON
file (times as ISO 8601 with an offset), dry run by default:

```ts
// scripts/import-signups.ts
import { runOpsScript } from "@softure-ai/ops/scripts";
import { createImportSignupsScript } from "@softure-ai/waitlist/scripts";
import config from "../softure.config";

// The app's own scope names, mapped to the module's scopes.
const script = createImportSignupsScript(config, { scopeAliases: { lists: ["launch", "newsletter"], start: ["launch"] } });
process.exitCode = await runOpsScript({ script, argv: process.argv.slice(2), config });
```

```bash
npx tsx scripts/import-signups.ts --file=signups.json            # dry run: counts before and after
npx tsx scripts/import-signups.ts --file=signups.json --commit
```

- **Rows.** `scopes` are ids of `waitlist({ scopes })` (or aliases, in the script), `placement`
  one of `placements`. `confirmedAt` defaults to `signedUpAt` (a list without double opt-in),
  `consentedAt` to `confirmedAt`. Requests that never confirmed are not imported: the person signs
  up again. `id` keeps the row's id, for links that carry it (below).
- **All or nothing.** Every row is checked first (declared scopes and placements, no time in the
  future, `confirmedAt >= signedUpAt`, `unsubscribedAt >= consentedAt`, no email or id twice, no id
  that belongs to another address and no address stored under another id); any problem refuses the
  whole input, listing row numbers, never an address. Then all rows are written in one transaction.
- **Idempotent, never narrowing.** An address already on the list widens its scopes, moves its
  `created_at` and `confirmed_at` back when the imported ones are earlier, fills an empty channel
  and keeps its placement and locale; a row still waiting for its link takes the imported scopes and
  becomes confirmed. Running the same file again changes nothing.
- **Consent evidence at its time.** Each scope gets a granted consent at `consentedAt` (source
  `waitlist-import`) through privacy's `importConsent`, with the configured version of the scope's
  document or the one `documentVersions` names (a consent to an older version reads as not current,
  so the next sign-up records the current one). A record with the same purpose, grant and time
  already in the ledger is not written again; times keep millisecond precision, as JSON has.
- **Opt-outs.** A row with `unsubscribedAt` gets a withdrawal per scope at that time and, unless
  a scope is granted again by a later record (a sign-up after the unsubscribe), a mailing opt-out
  made the way the person's own unsubscribe makes it (source `page`, which their next sign-up
  lifts once its link is used; without double opt-in it stays). It goes through mailing's `unsubscribe` with a link signed by `MAILING_UNSUBSCRIBE_SECRET`
  (an import with unsubscribed rows is refused without it), so the app's `onUnsubscribed` runs as
  for any unsubscribe; `withdrawWaitlistConsents` then finds nothing left to withdraw. The opt-out
  row carries the import's time, the withdrawal the historical one.
- **History, not new sign-ups**: no rate limit, no mail and no `onJoined`, so an analytics funnel
  does not count imported rows; `countSignupsByChannel(ctx)` counts the whole list per channel.
- **Old unsubscribe links.** When the app's earlier mail carried links naming its row id, import
  the `id` and resolve it in mailing's `legacyUnsubscribe` (mailing README):
  `verify: async (values, ctx) => (await getSignupById(ctx, values.id ?? ""))?.email ?? null`,
  after checking the old link's signature the app's way.

## 11. GDPR

- The waitlist contributes to `@softure-ai/privacy`: the export of an account holds the sign-up of
  its email address (scopes, placement, dates, `confirmedAt`, a pending request's scopes, the
  channel), and
  deleting the account deletes that sign-up.
  Privacy's own part covers the consents the sign-up recorded.
- Consents are recorded per scope with the document version in force, so the app can show what a
  person agreed to and when (`listConsents` of `@softure-ai/privacy/server`, subject `{ email }`).
  With double opt-in that is the version in force when the link is used; a document changed
  between the form and the link (at most the link's lifetime) is recorded in its newer version.
- With double opt-in, an address that never confirms is deleted by `pruneUnconfirmedSignups` once
  its link expires.
- A person without an account who asks for erasure: delete their row with
  `DELETE FROM waitlist.signups WHERE email = lower(btrim($1))` and their consents in
  `privacy.consents` by `email_key` (an operator task; there is no self-service page without an account).

## 12. Limitations

- Double opt-in is off by default: without it a sign-up counts at once, so a typo or a third
  party's address joins the list, and anyone who types an address can lift that address's opt-out
  by signing it up (bounded by the `waitlist-email` bucket).
- With double opt-in, anyone can make the module send a confirmation mail to any address, also one
  that opted out (it is transactional): bounded by the `waitlist-email` bucket, 3 per hour per
  address. The mail carries only the link and says to ignore it.
- Expired unconfirmed sign-ups stay until the app runs `pruneUnconfirmedSignups`; the module has
  no scheduler of its own.
- With double opt-in, a sign-up's channel reaches `onJoined` only through the confirmation link
  (`rewriteConfirmationLink`, section 10); a link opened on another device still carries it, a
  sign-up confirmed from an untagged link counts without one.
- The placement is stored per sign-up; placement counts are not handed to `@softure-ai/analytics`.
