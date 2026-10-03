# @softure-ai/billing

**Status:** wave 3 · entitlements and the write guard (MO-1); plans, pricing and payment adapters
arrive with MO-2 and MO-3 · depends on: core, db, ui, auth

Decides whether an account may still write: a trial every account starts with, paid access (dated
or lifetime) and a read-only state once both end. It replaces FIRE_TRACKER's access logic
(`src/lib/access.ts`, `src/db/access.ts`, `src/components/{access-badge,access-notice*}.tsx`), with
the `paid_until` and `trial_ends_at` columns moved off the users table into `billing.entitlements`
and the hand-written guard replaced by a pure state machine.

## 1. What it provides

- **A pure state machine** (`resolveEntitlement`, `applyEntitlementEvent` from the root entry): a
  record (trial end, paid until, lifetime) and an instant give `trial | paid | read_only`, with the
  days left and whether the reminder window is open; an event (`grant`, `grant_lifetime`, `revoke`,
  `extend_trial`) gives the next record. No database and no clock.
- **`billing.entitlements`**, at most one row per account, apart from `auth.users`. An account
  without a row is on the trial that starts at its `auth.users.created_at` (see §5).
- **The write guard**: `requireWriteAccess()` (`/next`) for server actions, `checkWriteAccess()`
  (`/server`) for other hosts.
- **`getEntitlement()`** and `getCurrentEntitlement()` to read where an account stands, and
  **`changeEntitlement()`**, the one write path (grants, revokes, trial extensions) the payment
  adapters build on.
- **`AccessBadge` and `AccessNotice`** (`/ui`), standalone with slots, `unstyled` and messages, and
  `CurrentAccessBadge` / `CurrentAccessNotice` (`/next`) wired to the signed-in account.
- Export and deletion of the entitlement row (`@softure-ai/privacy`), and a health check for
  `GET /api/health`.

## 2. Installation

```bash
npm install @softure-ai/billing @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm zod
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`. The module depends on `auth`; a
configuration without it fails at startup.

## 3. Configuration

```ts
import { billing } from "@softure-ai/billing";

// in defineSoftureConfig({ timezone: "Europe/Warsaw", modules: [...] }), after auth(...):
billing({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 } }),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `trial.days` | integer 0 to 365 | `14` | Length of the trial every account starts with, the registration day included. `0`: no trial, an account is read-only until it pays. |
| `trial.reminderDays` | integer 0 to 365 | `3` | From how many days left the trial counts as ending (badge tone, notice). `0`: never. |
| `paid.reminderDays` | integer 0 to 365 | `7` | The same for dated paid access. Lifetime access never ends. |
| `routes.payment` | path | `/payment` | Where the notice sends an account to pay (the payment page arrives with MO-2). |
| `messages` | partial `en` / `pl` | — | Copy overrides. |

**Days and time zones.** Trials end at the start of a local day in `config.timezone`: a 14-day
trial begun at any hour of 3 October ends when 17 October begins there, so 16 October is its last
day. Days left count local calendar days, today included (1 on the last day). Access covers every
instant before its end; at the end itself the account is read-only. Paid access wins over a trial;
a trial that outlasts paid access takes over again when the payment ends.

## 4. Mounting

Nothing to mount. Guard every write action of the app, before reading any input:

```ts
"use server";
import { requireWriteAccess } from "@softure-ai/billing/next";

export async function saveNote(formData: FormData) {
  const access = await requireWriteAccess(); // no session: redirects to the login page
  if (!access.ok) return access; // Err("billing.read_only"), for the form to show
  // ... the app's own authorization and the write, as access.value.user
}
```

Show where the account stands in any server component (both render nothing without a session):

```tsx
import { CurrentAccessBadge, CurrentAccessNotice } from "@softure-ai/billing/next";
import Link from "next/link";

<CurrentAccessBadge />
<CurrentAccessNotice LinkComponent={Link} />
```

Server functions, for scripts and other hosts (`@softure-ai/billing/server`):
`getEntitlement(ctx, userId)` returns the `Entitlement` or null for an unknown account;
`checkWriteAccess(ctx, userId)` returns `Ok<Entitlement>` or `Err<billing.read_only | billing.account_unknown>`;
`changeEntitlement(ctx, userId, event)` returns the `Entitlement` after the change or
`Err<billing.end_not_in_future | billing.account_unknown>`. A refused event writes nothing.

## 5. Migrations and tables

`migrations/0001_create_entitlements.sql` creates `billing.entitlements`:

| Column | Meaning |
| --- | --- |
| `user_id` | `uuid`, primary key, references `auth.users(id)` `ON DELETE CASCADE`. |
| `trial_ends_at` | The first instant the trial no longer covers. |
| `paid_until` | The first instant paid access no longer covers; NULL when never paid, revoked, or lifetime. |
| `is_lifetime` | Paid access without an end; a CHECK keeps it exclusive with `paid_until`. |
| `created_at`, `updated_at` | The first change and the last one. |

**No row until something changes.** Reads never write: an account without a row gets its trial
derived from `auth.users.created_at` and `trial.days`, so accounts created before billing was
enabled get a trial too and auth's single `onRegistered` hook stays free for the app. The first
change (`changeEntitlement`) stores that derived trial end with the event applied, so the trial end
never moves when a row appears. Until then, a change of `trial.days` changes the trial of accounts
without a row.

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

`AccessBadge` takes `classNames` for its slots `root`, `status` and `detail`; the status colour
follows the state (`--sft-color-foreground` for a trial, `success` when paid, `warning` in a
reminder window, `danger` when read-only). It sets `data-status` and, in a reminder window,
`data-ending="true"` for app styles. `AccessNotice` takes `root`, `message` and `actions` and
renders the `@softure-ai/ui` `ButtonLink`; ended access uses the danger surface of `FormError`.
Both accept `unstyled`.

## 9. Copy

`billingMessages` (`en`, `pl`): `badge` (status names, `daysLeft` plural forms, `until`), `notice`
(the four notices and their two link texts) and `errors`. `{date}` is the last day of access in
the app's locale and time zone, `{count}` the days left. Override them with
`billing({ messages: { en: { notice: { choosePlan: "See plans" } } } })`.

## 10. Hooks

None. Apps react to a change in their own code around `changeEntitlement`.

## 11. GDPR

- Export: the account's entitlement row (`trialEndsAt`, `paidUntil`, `isLifetime`, `createdAt`,
  `updatedAt`), or `{ entitlement: null }` for an account without one.
- Deletion: the row, and the foreign key removes it with the account too.

## 12. Limitations

- No plans, prices, payment page or payment adapter yet (MO-2: plans and a manual adapter; MO-3: a
  provider). `routes.payment` points at a page the app or MO-2 provides.
- The write guard is per action: a read-only account can still call a write the app did not guard.
- No reminder mail: the notice shows in the app only (followups FU-5).
- No history of changes: a row holds the current state; payment records belong to the adapters.
