# @softure-ai/privacy

GDPR self-service for a Next.js app: a signed-in user downloads everything the app stores about
them as JSON, or deletes their account, and neither lists tables by hand. Every enabled module that
holds user data contributes its own export and deletion; the app adds its own contributors. Built
from FIRE_TRACKER's `src/db/{account-export,account-deletion}.ts`, `src/app/api/moje-dane/` and
`scripts/delete-empty-account.mts`, where the tables were listed by hand and deletion ran only from
a CLI.

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
privacy({
  contributors: [{ id: "profile", exportUserData: exportProfile, deleteUserData: deleteProfile }],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `contributors` | `AppPrivacyContributor[]` | `[]` | The app's own data: `{ id, exportUserData?, deleteUserData? }`, at least one function each. |
| `contributors[].id` | `string` | required | Kebab-case, at most 64 characters, unique, and not the id of an enabled module: it is the key of the contributor's part of the export. |
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

Link the page from the app's account page. To build your own page, compose `DeleteAccountForm`
from `@softure-ai/privacy/ui` with `deleteAccountAction` from `/next`, and link to the export route.

The route answers 401 without a session, 429 with `retry-after` over the `privacy-export` limit,
413 over `export.maxBytes` and 500 when a contributor fails, each with `{ error: <code> }`. The
action reads the user from the session before it reads the form, and Next refuses it from another
origin. Outside a request, call `collectUserData(ctx, userId)` and `eraseUserData(ctx, userId)`
from `/server` (for example from an operator script); they apply no rate limit and ask for no
password.

## 5. Migrations and tables

None: the module keeps nothing of its own. Every contributor works on its own tables.

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

The page is built from `@softure-ai/ui` (`Card`, `ButtonLink`, `PasswordField`, `Checkbox`,
`FormError`, `Button` with the `danger` variant) and uses only its compiled classes, so
`@softure-ai/ui/styles.css` styles it and the `--sft-*` tokens theme it. `DeleteAccountForm` takes
`classNames` for its slots (`root`, `description`, `form`) and `unstyled`.

## 9. Copy

`privacyMessages.{en,pl}`: `page` (title, lead), `export` (title, description, button), `delete`
(title, description, password label, confirmation, submit and pending labels) and `errors` for every
code the form and the route can give (`privacy.*`, `auth.unauthenticated`, `security.rate_limited`,
`core.*`). Override any of them with
`privacy({ messages: { pl: { errors: { privacy: { deletion_refused: "…" } } } } })`, for example to
say how to reach the app's support.

## 10. Hooks

The contributors (section 3) are the hooks. The rate limit buckets, both per user, are
`PRIVACY_RATE_LIMIT_BUCKETS`: `privacy-export` (5 an hour) and `privacy-delete` (5 attempts in 15
minutes, each a password check). Spread them into `security({ buckets })`; a missing bucket throws
on first use and names it.

## 11. GDPR

This module is the GDPR surface: right of access (the export) and right to erasure (the deletion).
It stores nothing itself. What each module exports and deletes is in that module's section 11.
Rate limit rows of `security` hold only SHA-256 prefixes of user ids and emails and are pruned two
windows after they start.

## 12. Limitations

- The export is built in memory and bounded by `export.maxBytes`; there is no streaming or
  background export with a download link yet.
- Deletion is immediate: there is no grace period and no undo. Back up the database if the app
  needs to restore accounts.
- No deletion by an admin or from a CLI yet; call `eraseUserData` from a script of the app.
- Consents and the legal document shell arrive with the next item of the roadmap (`privacy.consents`).
