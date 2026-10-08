# @softure-ai/privacy

GDPR self-service and consent evidence for a Next.js app: a signed-in user downloads everything
the app stores about them as JSON, or deletes their account, and neither lists tables by hand; every
consent is recorded with the version of the legal document it was given to; legal pages render
from the app's own text. Every enabled module that
holds user data contributes its own export and deletion; the app adds its own contributors. Built
from an app where the tables of the export and the deletion were listed by hand, deletion ran only
from a CLI, the registration checkbox was checked but nothing was stored, and the legal pages had
their own document frame and footer.

## 1. What it provides

- **A contributor registry.** Each module states what it holds through
  `defineModule({ privacy: { exportUserData, deleteUserData } })` (`@softure-ai/core`, checked
  against its manifest's `privacy` flags); the app adds `privacy({ contributors })`. A module is in
  the export and the deletion by being enabled.
- **The export.** `GET /api/privacy/export` answers a JSON attachment (`account-data-<date>.json`)
  with every contributor's part under its id, read in one repeatable-read transaction, bounded by
  `export.maxBytes`.
- **The deletion.** A page with the export link and a delete form that asks for the current
  password and an explicit confirmation. Every contributor deletes in one transaction; a refusal or
  a failure rolls everything back. The sessions end with the account, the cookie is cleared, and the
  browser lands on `afterDelete`.
- **The consent ledger.** `privacy.consents` records who agreed to what, when, where and against
  which version of which legal document. It is append-only: a withdrawal is a new row, and the
  database refuses to update one. A ready hook records the registration checkbox of
  `@softure-ai/auth`; other modules (the waitlist) record their own scopes.
- **Copying an account between databases.** `copyAccount({ from, to, userId })` copies one account
  with every row it owns, found through foreign keys, with exact values; a verified dry run by
  default (section 11).
- **The legal document shell.** `LegalDocument`, `LegalSection` and `LegalFooter` render the app's
  terms and privacy policy: version, effective date, table of contents, change history.

`@softure-ai/auth`, `@softure-ai/feature-switches` and `@softure-ai/mcp-access` contribute already (their README section 11).

## 2. Installation

```bash
npm install @softure-ai/privacy @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`. The module depends on `auth` (the account
and the session) and `security` (rate limits): a configuration without them fails at startup.

## 3. Configuration

```ts
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { security } from "@softure-ai/security";
import { deleteProfile, exportProfile } from "./lib/profile-privacy";

// in defineSoftureConfig({ modules: [...] }):
security({ clientIp: cloudflareIp(), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS } }),
auth({ ... }),
auth({ onRegistered: recordRegistrationConsent() }), // from @softure-ai/privacy/server
privacy({
  documents: [
    { id: "terms", version: "2026-10-01" },
    { id: "privacy-policy", version: "2026-10-01" },
  ],
  contributors: [{ id: "profile", exportUserData: exportProfile, deleteUserData: deleteProfile }],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `contributors` | `AppPrivacyContributor[]` | `[]` | The app's own data: `{ id, exportUserData?, deleteUserData? }`, at least one function each. |
| `contributors[].id` | `string` | required | Kebab-case, at most 64 characters, unique, and not the id of an enabled module: it is the key of the contributor's part of the export. |
| `documents` | `{ id, version }[]` | `[]` | The app's legal documents and the versions in force. A consent names a document by id and privacy records this version with it. Change `version` whenever the published text changes (a date such as `2026-10-01` works well). |
| `documents[].id` | `string` | required | Kebab-case, at most 64 characters, unique, e.g. `terms`, `privacy-policy`. |
| `documents[].version` | `string` | required | 1-32 letters, digits, `.`, `_` or `-`. |
| `export.maxBytes` | `number` | `10485760` (10 MiB) | The largest export, in bytes of JSON (1 KiB to 100 MiB). A larger one is refused with `privacy.export_too_large`. |
| `export.fileName` | `string` | `account-data` | The download's name before the date. |
| `routes` | `{ account, export, afterDelete }` | `/account/privacy`, `/api/privacy/export`, `/` | Where the page and the route are mounted, and where a deleted account lands. |
| `messages` | partial `pl` / `en` dictionaries | built in | Copy overrides (section 9). |

A contributor is two functions over the module context (`{ db, clock, config }`, `db` being the
transaction) and the user id:

```ts
import { ok, type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { profiles } from "../db/schema";

export async function exportProfile(context: ModuleContext, userId: string) {
  const db = context.db as Queryable;
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return ok({ displayName: profile?.displayName ?? null });
}

export async function deleteProfile(context: ModuleContext, userId: string) {
  await (context.db as Queryable).delete(profiles).where(eq(profiles.userId, userId));
  return ok();
}
```

Rules for a contributor:

- Query through `context.db` only: it is the transaction. A query on another handle is outside the
  rollback and, under Postgres, waits on the transaction's locks.
- `exportUserData` only reads: the export runs in a read-only transaction. Export plain JSON
  values (dates become ISO strings), and never secrets: password hashes, token hashes, API keys.
- Delete (or anonymise) everything that names the user. To keep data for a legal reason, return an
  `Err` from `deleteUserData`: nothing is deleted, the user sees `privacy.deletion_refused`, and the
  contributor's id and code are logged.
- Throw only for bugs and database failures; both roll the deletion back.

**Order.** The export runs the modules in the config's dependency order (dependencies first), then
the app's contributors in their listed order. The deletion runs the reverse: the app's contributors
first (last listed first), then each module before the modules it depends on, auth last. A row is
therefore always deleted before the rows it references, whatever its foreign key's `ON DELETE`.

### Consents

```ts
import { getConsent, hasConsent, listConsents, recordConsent } from "@softure-ai/privacy/server";

await recordConsent(ctx, { subject: { userId }, purpose: "newsletter", granted: true, source: "account" });
await recordConsent(ctx, { subject: { email }, purpose: "newsletter", granted: false, source: "unsubscribe" });
await recordConsent(ctx, { subject: { userId }, purpose: "terms", granted: true, document: "terms", source: "account" });
await hasConsent(ctx, { subject: { userId }, purpose: "terms" }); // latest row granted, current version
```

- `subject` is an account (`{ userId }`) or an email address without one (`{ email }`, stored as a
  SHA-256 key, never as the address; `{ emailKey }` names the same subject by that key, for a
  caller that holds only the key, such as mailing's unsubscribe hook). Reads keep the two apart; the export and the deletion of an
  account cover both, so a waitlist consent given before registering goes with the account.
- `purpose` and `source` are kebab-case (at most 64 characters); `document` names a declared
  document, whose configured version is recorded. A bad subject, purpose or source gives
  `privacy.consent_invalid`, an undeclared document `privacy.document_unknown`.
- A withdrawal is `granted: false`: a new row, the earlier one stays as evidence. The state of a
  purpose is its latest row: `getConsent` returns it with `isCurrentVersion` (false once the
  document's configured version moved on, or the document is no longer declared), `hasConsent` is
  true only for a granted row of the current version, `listConsents` gives the whole history.
- Call these inside the transaction of the action they belong to (`ctx.db` being the transaction),
  so the action and its evidence commit together.

**History from before the ledger.** `importConsent(ctx, { ...input, recordedAt, documentVersion? })`
records a consent or withdrawal at the time it was given, for an app that moves its own records onto
the ledger (the waitlist's `importSignups` uses it). `recordedAt` must not be after now;
`documentVersion` (1 to 64 visible ASCII characters, only with `document`) records the version the
person agreed to instead of the configured one, so an older text stays an older-version consent
(`hasConsent` false, and the next consent records the current version). It writes every call: a
caller that may run twice checks `listConsents` first.

**Registration.** `recordRegistrationConsent({ documents? })` is an `onRegistered` hook for auth:
when the app keeps `requireConsent` on, it records one row per document (purpose = the document's
id, source `registration`) at the account's creation time, in the account's transaction. By
default it records every declared document; `documents: ["terms"]` narrows it. With no document
declared, or an undeclared one named, it throws and the registration rolls back: an account never
exists without the evidence of its consent.

## 4. Mounting

```ts
// app/account/privacy/page.tsx: the export link and the delete form; redirects to login without a session.
export { PrivacyPage as default } from "@softure-ai/privacy/next";
export const dynamic = "force-dynamic";
```

```ts
// app/api/privacy/export/route.ts: the JSON download for the session's user.
export { exportRoute as GET } from "@softure-ai/privacy/next";
```

Legal pages are the app's own pages around `LegalDocument`, with the text from the app's
dictionaries or content files and the version from the config:

```tsx
// app/legal/terms/page.tsx
import { getPrivacyMessages } from "@softure-ai/privacy/next";
import { getLegalDocument } from "@softure-ai/privacy/server";
import { LegalDocument } from "@softure-ai/privacy/ui";
import config from "../../../softure.config";
import { terms } from "../../../content/terms";

export default function TermsPage() {
  return (
    <LegalDocument
      title={terms.title}
      version={getLegalDocument(config, "terms").version}
      effectiveFrom="2026-10-01"
      sections={terms.sections} // [{ id: "your-account", title: "2. Your account", content: <p>…</p> }]
      changes={terms.changes} // newest first: [{ version, date: "2026-10-01", summary }]
      messages={getPrivacyMessages(config)}
      locale={config.locale}
    />
  );
}
```

An app whose page frame already shows the title and its own "in force" sentence leaves out `title`
and passes `meta={null}` (or its own node, `meta={<p>…</p>}`) instead of `version` and
`effectiveFrom`: the shell then renders no `<h1>` and adds no sentence. A history entry needs only a
`summary`; `version` and `date` are rendered when given. For a contents column beside the text, put
a grid on `root`, `header` across both columns, and the `contents` and `body` slots side by side;
`contentsTitleAs="p"` turns the contents heading into a label and `listChangesInContents` links the
history last:

```tsx
<LegalDocument
  meta={null}
  sections={terms.sections}
  changes={[{ summary: "Changed 23 September 2026: paid access." }]}
  listChangesInContents
  contentsTitleAs="p"
  classNames={{
    root: "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-16", // the app's own classes
    contents: "lg:sticky lg:top-24 lg:self-start",
  }}
  messages={getPrivacyMessages(config)}
  locale={config.locale}
/>
```

`LegalFooter` (`links: [{ href, label }]`, an optional `note`) goes into the root layout. Inside the
app's own `<footer>`, pass `as="div"` (or `as="nav"` for the navigation alone) so there is no footer
inside a footer; `separator=" · "` puts a separator, hidden from assistive technology, between the
links. For one line of text inside the app's own footer or under a form, pass `as="p"` (or
`as="span"`): the links and separators become inline content with no navigation and no list, the
separator (default `" · "`, `null` for none) is read as text, and the `note` follows the links in a
`span`.

`LegalDocument` names its contents by a generated id, so two documents can share a page; give each
its own history anchor with `changesId` (default `legal-changes`). `as` sets the root element
(`article` by default, `div` or `section`).

Link the page from the app's account page. To build your own page, compose `DeleteAccountForm`
from `@softure-ai/privacy/ui` with `deleteAccountAction` from `/next`, and link to the export route.

The route answers 401 without a session, 429 with `retry-after` over the `privacy-export` limit,
413 over `export.maxBytes` and 500 when a contributor fails, each with `{ error: <code> }`. The
action reads the user from the session before it reads the form, and Next refuses it from another
origin. Outside a request, call `collectUserData(ctx, userId)` and `eraseUserData(ctx, userId)`
from `/server` (for example from an operator script); they apply no rate limit and ask for no
password.

## 5. Migrations and tables

Schema `privacy`, one migration:

| Table | Columns | Notes |
| --- | --- | --- |
| `consents` | `id` (identity), `user_id` (FK `auth.users`, cascade) or `email_key` (base64url SHA-256 of the trimmed, lowercased address), `purpose`, `granted`, `document_id` + `document_version` (both or neither), `source`, `recorded_at` | exactly one subject (`consents_one_subject`); a `BEFORE UPDATE` trigger refuses every update; indexed by subject, purpose and time |

The export and the deletion run every other contributor on its own tables. `GET /api/health` of
`@softure-ai/ops` checks that the table answers.

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

The page is built from `@softure-ai/ui` (`Card`, `ButtonLink`, `PasswordField`, `Checkbox`,
`FormError`, `Button` with the `danger` variant) and uses only its compiled classes, so
`@softure-ai/ui/styles.css` styles it and the `--sft-*` tokens theme it. `DeleteAccountForm` takes
`classNames` for its slots (`root`, `description`, `form`) and `unstyled`.

The legal components are server components with the same rules. `LegalDocument` slots: `root`,
`header`, `title`, `meta`, `intro`, `contents`, `contentsTitle`, `contentsList`, `link`, `body` (the
sections and the history), `changes`, `changesTitle`, `changesList`, `change`, `changeMeta`, and
`sectionClassNames` for every `LegalSection` (`root`, `title`, `body`). `LegalFooter` slots: `root`,
`list` (the list form only), `link`, `separator`, `note`; the inline form (`as="p"`, `as="span"`)
has its own defaults, which keep only the type and colour on the root.
Sections scroll into view below a sticky header through `scroll-mt`; dates (`YYYY-MM-DD`) are
written in the app's locale, in UTC so the server's time zone cannot move them.

## 9. Copy

`privacyMessages.{en,pl}`: `page` (title, lead), `export` (title, description, button), `delete`
(title, description, password label, confirmation, submit and pending labels), `legal` (contents,
version, effective from, change history, the footer's navigation name) and `errors` for every
code the form and the route can give (`privacy.*`, `auth.unauthenticated`, `security.rate_limited`,
`core.*`). Override any of them with
`privacy({ messages: { pl: { errors: { privacy: { deletion_refused: "…" } } } } })`, for example to
say how to reach the app's support.

## 10. Hooks

The contributors (section 3) are the hooks. `recordRegistrationConsent()` is a ready hook for
auth's `onRegistered` (section 3). The rate limit buckets, both per user, are
`PRIVACY_RATE_LIMIT_BUCKETS`: `privacy-export` (5 an hour) and `privacy-delete` (5 attempts in 15
minutes, each a password check). Spread them into `security({ buckets })`; a missing bucket throws
on first use and names it.

## 11. GDPR

This module is the GDPR surface: right of access (the export) and right to erasure (the deletion),
and the evidence of consent (Art. 7(1)). What each module exports and deletes is in that module's
section 11.

Its own part is the consent ledger. The export lists every consent of the account and of its email
address (`privacy.consents`, oldest first, each marked `account` or `email`; the email key is left
out). The deletion removes them: once the data is gone there is nothing left to prove consent for.
An email subject is stored only as a SHA-256 key, so the table holds no address; the key is a
pseudonym, not anonymous data, because anyone with the address can compute it.
Rate limit rows of `security` hold only SHA-256 prefixes of user ids and emails and are pruned two
windows after they start.

### Copying an account to another database

`copyAccount` (`@softure-ai/privacy/server`) copies one account, with every row it owns, from one
database to another: an app moving an account between instances or out of a shared database. The
source keeps the account; `eraseUserData` there is a separate step.

```ts
// scripts/copy-account.mts: node scripts/copy-account.mts <userId> [--commit]
import { createDatabase } from "@softure-ai/db";
import { copyAccount } from "@softure-ai/privacy/server";

const [userId = "", flag] = process.argv.slice(2);
const from = await createDatabase(process.env.FROM_DATABASE_URL ?? "");
const to = await createDatabase(process.env.TO_DATABASE_URL ?? "");
try {
  const result = await copyAccount({
    from: from.db,
    to: to.db,
    userId,
    commit: flag === "--commit",
    exclude: ["auth.sessions"],
    include: [{ table: "waitlist.signups", column: "email", matches: "email" }],
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await Promise.all([from.close(), to.close()]);
}
```

- **Which rows.** The account's `auth.users` row; every row that references a copied row through a
  foreign key whose ON DELETE is CASCADE, RESTRICT or NO ACTION (the rows deleting the account
  removes or is blocked by), transitively, so a table without a user column (a payment's refund
  failures) comes along; and the account's email-keyed consents. A new module or app table is
  covered by its foreign key, with no list to maintain. A SET NULL key is a mention (the admin who
  granted something), not ownership. A table's foreign key to itself is not followed.
  `exclude` leaves tables out (and what only they reach); `include` adds a table no foreign key
  ties to the account, by a column holding its id or email (`waitlist.signups` by `email`).
- **Exact values.** Every column is read as text and written back cast to its type, with the
  session's time zone and date style fixed on both sides: a `timestamptz` keeps its microseconds
  (`pg` would round it to milliseconds through `Date`), a NULL stays NULL. Generated columns are
  left to the target, and so is a generated primary key nothing references (`privacy.consents.id`),
  which gets a new value in the source's order; a written identity or serial key moves its sequence
  past the copied maximum.
- **Dry run and verification.** Without `commit: true` the copy runs whole in the target, is
  verified, and is rolled back; a dry run that succeeds is a copy that would succeed. The
  verification reads every copied table back and compares it value for value with what was
  written. A dry run can leave gaps in the target's sequences (a sequence never rolls back).
- **Refusals.** Returned as `{ ok: false, error, detail }`, with nothing written:
  `privacy.copy_account_missing` (no such account in the source), `copy_account_exists` (the target
  has its id or email), `copy_schema_mismatch` (a table or column missing in the target, or of
  another type), `copy_reference_missing` (a copied row references a row neither the copy nor the
  target has, such as an OAuth client), `copy_conflict` (a target constraint rejects a row; the
  detail names it), `copy_unsupported` (a cycle of foreign keys between tables),
  `copy_verification_failed`. With `onMissingReference: "null"`, a SET NULL key whose row the target
  lacks is written as NULL instead, and counted in the report.

The report lists every table the account reaches, in insert order, with its row count.

## 12. Limitations

- The export is built in memory and bounded by `export.maxBytes`; there is no streaming or
  background export with a download link yet.
- Deletion is immediate: there is no grace period and no undo. Back up the database if the app
  needs to restore accounts.
- No deletion by an admin or from a CLI yet; call `eraseUserData` from a script of the app.
- `copyAccount` holds each table's rows of the account in memory: meant for one account at a time.
- No page to review or withdraw consents yet; withdrawals come from the module that asked (the
  waitlist, an unsubscribe) or from the app calling `recordConsent` with `granted: false`.
- A new document version does not ask anyone to accept it again: `hasConsent` turns false and the
  app decides what to show.
- Legal text is the app's: the shell renders it, it does not write it.
