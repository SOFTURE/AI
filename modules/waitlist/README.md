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
  the config's order, the placement of the first sign-up, the locale, two timestamps.
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
  unsubscribe link and RFC 8058 headers and is never sent to an address that unsubscribed.
- **A rate-limited public action**: bucket `waitlist` per client, `waitlist-email` per address.
- `<Waitlist placement="hero" />` (`/next`), the form wired in one line, and `WaitlistForm` (`/ui`)
  with slots, `unstyled` and messages for an app that composes its own.
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
import { en } from "./messages/en";
import { pl } from "./messages/pl";

// in defineSoftureConfig({ modules: [...] }):
security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...WAITLIST_RATE_LIMIT_BUCKETS } }),
auth({ ... }),
mailing({ from: "Acme <hello@mail.acme.com>", provider: resend() }),
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
| `welcomeMail` | `boolean` | `true` | Sends the welcome mail. Off, the app sends its own (or none). |
| `messages` | partial `en` / `pl` | — | Copy overrides, the welcome mail's subject and text included. |

`WAITLIST_RATE_LIMIT_BUCKETS` is `{ waitlist: { limit: 10, windowMinutes: 15 }, "waitlist-email": { limit: 3, windowMinutes: 60 } }`.
Every attempt counts per client before anything is checked; the per-address bucket stops one
address from being signed up over and over. The first sign-up checks once that both buckets are
configured and that every scope's document is declared, and throws naming what is missing.

The welcome mail is list mail, so mailing needs `MAILING_UNSUBSCRIBE_SECRET` (mailing README §6);
without it the mail is refused and the sign-up still succeeds.

## 4. Mounting

Nothing to mount: the form posts to a server action that ships in the package. Embed it in any
server component:

```tsx
import { Waitlist } from "@softure-ai/waitlist/next";

<Waitlist placement="hero" />
// a label with a link, in place of the config's text:
<Waitlist placement="footer" consentLabels={{ launch: <>Tell me when it opens (<a href="/legal/privacy">privacy policy</a>).</> }} />
```

An app that composes its own form passes `joinWaitlistAction` (`/next`) to `WaitlistForm` (`/ui`)
with the scopes it prepared (`{ id, label, required }`), the placement and the messages.

Server functions, for scripts and other hosts (`@softure-ai/waitlist/server`):
`joinWaitlist(ctx, { email, scopes, placement, clientKey })` returns
`Ok<{ signup, isNew, recordedScopes }>` or `Err<waitlist.email_invalid | waitlist.consent_required | waitlist.form_invalid | security.rate_limited>`;
`deliverWelcomeMail(ctx, signup)` returns mailing's `DeliveryOutcome` or `{ status: "skipped" }`;
`getSignup(ctx, email)`; `listSignups(ctx, { scope?, placement? })`, oldest first. A launch mail is
a loop over `listSignups(ctx, { scope: "launch" })` with mailing's `deliverOnce` (or a mailing
campaign): unsubscribed addresses are refused there.

## 5. Migrations and tables

`migrations/0001_create_signups.sql` creates `waitlist.signups` and the function
`waitlist.is_scope_list(text[])` its check uses:

| Column | Meaning |
| --- | --- |
| `id` | `uuid`, the sign-up; the welcome mail's delivery scope names it. |
| `email` | Trimmed and lowercased (a CHECK), unique (`signups_email_key`). |
| `scopes` | `text[]`: 1 to 16 distinct kebab-case ids of at most 64 characters, in the config's order. GIN index for lists by scope. |
| `placement` | Kebab-case, the first sign-up's form. |
| `locale` | The app's locale at the first sign-up: the welcome mail's language. |
| `created_at`, `updated_at` | The first sign-up and the last widening. |

Scope ids are validated text, not an enum or a CHECK list: they are the app's, and a list in the
database would need a module migration for every app's change of copy.

## 6. Environment variables

None of its own. The welcome mail needs mailing's `MAILING_UNSUBSCRIBE_SECRET`.

## 7. Switches

None. `welcomeMail: false` turns the mail off.

## 8. Appearance

`WaitlistForm` uses the `@softure-ai/ui` primitives (TextField, Checkbox, FormError, Button) and
takes `classNames` for its slots `root`, `form`, `scopes` and `notice`, or `unstyled`. `Waitlist`
passes both through.

## 9. Copy

`waitlistMessages` (`en`, `pl`): `form` (field label, button, pending text, the confirmation),
`welcomeMail` (subject and text; mailing appends the unsubscribe footer) and `errors`. Override
them with `waitlist({ messages: { pl: { welcomeMail: { subject: "…" } } } })`. Scope labels are
the app's, in `scopes[].label` or `consentLabels`.

## 10. Hooks

None. `joinWaitlist` returns `isNew` and `recordedScopes` for an app that reacts to a sign-up in its
own server code.

## 11. GDPR

- The waitlist contributes to `@softure-ai/privacy`: the export of an account holds the sign-up of
  its email address (scopes, placement, dates), and deleting the account deletes that sign-up.
  Privacy's own part covers the consents the sign-up recorded.
- Consents are recorded per scope with the document version in force, so the app can show what a
  person agreed to and when (`listConsents` of `@softure-ai/privacy/server`, subject `{ email }`).
- A person without an account who asks for erasure: delete their row with
  `DELETE FROM waitlist.signups WHERE email = lower(btrim($1))` and their consents in
  `privacy.consents` by `email_key` (an operator task; there is no self-service page without an account).

## 12. Limitations

- No double opt-in: a sign-up counts at once. A confirmation step can come later as an option (a
  `confirmed_at` column and a link in the welcome mail).
- Unsubscribing through mailing's link stops list mail but does not record a withdrawal in the
  consent ledger, and signing up again does not lift a mailing suppression: both need a mailing hook.
- The placement is stored per sign-up; handing placement counts to `@softure-ai/analytics` belongs
  to the analytics roadmap.
- The welcome mail's copy is text only; an HTML version needs an option for the app's template.
