# @softure-ai/feature-switches

Runtime switches for a Next.js app: features turned on and off without a deploy, each declared once
with a default and a fail mode, overridable from the environment, and flipped by an admin in a
generic panel that is closed to everyone else. Switches come from a declared registry, not from
hard-coded names, and the panel sits behind a role from `@softure-ai/auth`.

## 1. What it provides

The table `features.switches`, the app's declared switches (`featureSwitches({ switches })`),
`isEnabled(name)` for server code (one read per request in Next, fresh in scripts), `setSwitch` with
`updated_at` and `updated_by`, an admin-only panel page and its server action, a `SwitchPanel`
client component, a health check that `GET /api/health` of `@softure-ai/ops` runs, and the app's
switch reader, through which other modules (auth) read the switches they name (section 7).

A switch's value is, in this order:

1. its **environment override** (`SOFTURE_SWITCH_<NAME>`, below), when set;
2. the value an admin **stored** in the panel;
3. its declared **default**.

When the stored state cannot be read (the database is down) or the override is not a boolean, the
switch takes its **fail mode**: `closed` reads as off, `open` reads as on. A database failure never
fails the request that asked; it is logged once per read.

## 2. Installation

```bash
npm install @softure-ai/feature-switches @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`. The module depends on `auth` (and auth on
`security`): a configuration without them fails at startup, so the panel is never mounted without a
role check.

## 3. Configuration

```ts
import { auth } from "@softure-ai/auth";
import { featureSwitches } from "@softure-ai/feature-switches";
import { en } from "./messages/en";
import { pl } from "./messages/pl";

// in defineSoftureConfig({ modules: [...] }), after security(...) and auth(...):
featureSwitches({
  switches: [
    {
      name: "billing.checkout_enabled",
      label: { en: en.switches.checkout.label, pl: pl.switches.checkout.label },
      description: { en: en.switches.checkout.description, pl: pl.switches.checkout.description },
      default: false,
      failMode: "closed",
    },
  ],
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `switches` | `SwitchDefinition[]` | `[]` | Every switch the app reads, including the ones its modules name in their manifests. |
| `switches[].name` | `string` | required | `<scope>.<key>`: a kebab-case scope (a module id or the app's own) and a snake_case key, at most 100 characters. |
| `switches[].label` | `{ en?, pl? }` | the name | The panel's name for it, per locale; a missing locale falls back to `en`. Keep the copy in the app's message dictionaries. |
| `switches[].description` | `{ en?, pl? }` | none | What turning it on does, shown under the label. |
| `switches[].default` | `boolean` | required | The value while nothing is stored and no override is set. There is no implicit default: pick the value that keeps the app safe on a fresh database. |
| `switches[].failMode` | `"closed"` \| `"open"` | `"closed"` | The value when the stored state cannot be read: `closed` is off, `open` is on. Name switches so that "on" turns something on, and the fail mode reads naturally. |
| `switches[].override` | `"both"` \| `"towards-fail-mode"` | `"both"` | Which way the environment override may move the switch: either way, or only to the fail-mode value (section 6). |
| `panelRole` | `string` | `"admin"` | The auth role that opens the panel and flips switches. It must be declared in `auth({ roles })` (`admin` always is); an undeclared role throws. |
| `routes` | `{ panel }` | `/admin/switches` | Where the panel page is mounted. |
| `messages` | partial `pl` / `en` dictionaries | built in | Copy overrides (section 9). |

A name declared twice, or two names whose environment overrides collide (`my-app.beta` and
`my.app_beta` both give `SOFTURE_SWITCH_MY_APP_BETA`), fail at startup.

## 4. Mounting

```ts
// app/admin/switches/page.tsx: the panel. Not found for anyone without panelRole, signed in or not.
export { SwitchesPage as default } from "@softure-ai/feature-switches/next";
export const dynamic = "force-dynamic";
```

Reading a switch in server code (pages, layouts, actions, route handlers):

```ts
import { isEnabled } from "@softure-ai/feature-switches/next";

if (await isEnabled("billing.checkout_enabled")) {
  // ...
}
```

`isEnabled` from `/next` reads every stored row once per request (React `cache`), however many
components ask; nothing is cached across requests, so a flip is visible on the next request on
every instance. Outside a request (scripts, jobs) use `isEnabled(ctx, name)` from `/server` with the
module context; it reads the one row each call. Both throw for a name the app did not declare.

### The panel inside the app's own page shell

`SwitchesPage` renders its own `<main>` and `Card` title. An app whose panel screens share a container
and a heading builds the page from the same parts, behind its own `requireRole` check:

```tsx
// app/settings/switches/page.tsx
import { requireRole } from "@softure-ai/auth/next";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getFeatureSwitchesMessages, getSwitchContext, setSwitchAction, toSwitchPanelRows } from "@softure-ai/feature-switches/next";
import { getFeatureSwitchesOptions, listSwitches, listUndefinedManifestSwitches } from "@softure-ai/feature-switches/server";
import { SwitchPanel } from "@softure-ai/feature-switches/ui";

export const dynamic = "force-dynamic";

export default async function SwitchesSettingsPage() {
  const config = getSoftureConfig();
  await requireRole(getFeatureSwitchesOptions(config).panelRole);
  const messages = getFeatureSwitchesMessages(config);
  const views = await listSwitches(await getSwitchContext(config));
  return (
    <AppPanelShell title={messages.panel.title}>
      <SwitchPanel
        switches={toSwitchPanelRows(views, messages, config)}
        undefinedSwitches={listUndefinedManifestSwitches(config)}
        action={setSwitchAction}
        messages={messages}
        locale={config.locale}
      />
    </AppPanelShell>
  );
}
```

`toSwitchPanelRows(views, messages, config)` is the mapping `SwitchesPage` uses: the label, the
description, `isLocked` for a switch held by its environment override, and the sentence that says
where the value comes from (`describeSwitchSource`, with a stored date in `config.locale` and
`config.timezone`). Mount the page at the panel route, or name the app's path in
`featureSwitches({ routes: { panel: "/settings/switches" } })`: `setSwitchAction` revalidates
`routes.panel` after every stored change, so each row's source note shows the new date without a
reload.

### Tests that import `/next`

`@softure-ai/feature-switches/next` imports `@softure-ai/auth/next`, which imports `next/headers`
without an extension (Next's bundler needs the bare specifier). Under Vitest, inline the packages so
Vite resolves it:

```ts
// vitest.config.ts
test: { server: { deps: { inline: [/@softure-ai\/(auth|feature-switches)/] } } },
```

The panel's action checks the role with `authorizeRole(panelRole)` before it reads the form, and
answers `auth.forbidden` to anyone without it, stored session or not. Do not add the panel path to
the auth route guard's `protect` list: an anonymous visitor gets "not found", not the login page.

## 5. Migrations and tables

Schema `features`, migration `0001_create_switches.sql`:

| Table | Columns | Notes |
| --- | --- | --- |
| `switches` | `name` (PK), `enabled`, `updated_at`, `updated_by` | `name` has the shape `CHECK`. `updated_by` is the auth user id of the admin who set it (null when set outside a session), with no foreign key: deleting an account clears it through `@softure-ai/privacy` (section 11) and keeps the switch. |

A switch with no row reads as its default. Rows of switches the app no longer declares are ignored,
never deleted: declaring the switch again brings back its last stored value. Run `softure migrate`
(or the container step of `@softure-ai/ops`); the app's least-privilege role needs no extra grant.

### Adopting an existing switches table

An app that already stores its switches in a table of its own keeps the data by moving that table
into the module's shape in its own migration, then declaring `baseline: { "feature-switches": 1 }`
in its `AppMigrations` (`@softure-ai/db` README, "A baseline"). The baseline comparison checks the
schema, column types, nullability, defaults and constraint names against `0001_create_switches.sql`,
so each step below is needed. For a table `public.feature_switches (name text PRIMARY KEY, enabled
boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now())`:

```sql
CREATE SCHEMA IF NOT EXISTS features;
ALTER TABLE public.feature_switches SET SCHEMA features;
ALTER TABLE features.feature_switches RENAME TO switches;
-- The comparison sees constraint names: the primary key keeps the old table's name otherwise.
ALTER TABLE features.switches RENAME CONSTRAINT feature_switches_pkey TO switches_pkey;
-- The module writes every column itself: no defaults, no nulls.
ALTER TABLE features.switches
  ALTER COLUMN enabled DROP DEFAULT,
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN updated_at SET NOT NULL,
  ADD COLUMN updated_by text;
-- Stored switches are named <scope>.<key>; rename each one to the name the app now declares.
UPDATE features.switches SET name = 'auth.registration_closed' WHERE name = 'registration_closed';
-- Rows that still fail the name shape cannot be read by any declared switch: drop them.
DELETE FROM features.switches
WHERE char_length(name) > 100 OR name !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9_]*$';
ALTER TABLE features.switches
  ADD CONSTRAINT switches_name_check
    CHECK (char_length(name) <= 100 AND name ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT switches_updated_by_check CHECK (char_length(updated_by) BETWEEN 1 AND 200);
```

- Rename before you delete: a name without a scope (`registration_closed`) fails the shape check.
- Convert other column types in the same migration (`ALTER COLUMN updated_at TYPE timestamptz USING …`).
- Existing rows keep `updated_by` null ("set outside a session"); the module fills it on the next change.
- The module's test suite runs this script over a legacy table and migrates with the baseline, so the
  recipe stays in step with `0001_create_switches.sql`.

### Changing a switch from SQL

The break-glass path when the panel is unavailable and no environment override is in place. `updated_at`
has no default, and `updated_by` is null for a change made outside a session:

```sql
INSERT INTO features.switches (name, enabled, updated_at)
VALUES ('auth.registration_closed', true, now())
ON CONFLICT (name) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = NULL;
```

Use a declared name: a row for any other name is stored and ignored. The change is visible on the next
request, on every instance.

## 6. Environment variables

The module requires none. Every declared switch can be overridden by
`SOFTURE_SWITCH_<NAME>`, where `<NAME>` is the switch name in upper case with `.` and `-` as `_`
(`billing.checkout_enabled` → `SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED`). `true`, `1`, `on` turn it on;
`false`, `0`, `off` turn it off; an empty value is no override. Any other value gives the fail mode
and logs the variable name once (never its value). While an override is set, the panel shows the
switch as held by the environment and disables its toggle. The override is the way back from a bad
flip that broke the panel itself.

A switch declared with `override: "towards-fail-mode"` takes only one direction from its variable:
the fail-mode value (on for `failMode: "open"`, off for `"closed"`). The other value is ignored, the
switch reads on from the stored row or the default as if the variable were unset, and the variable
name is logged once. Use it for a kill switch an operator may pull but must not push back, such as
closing registration: `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED=false` then cannot reopen what an
admin closed.

## 7. Switches

The module declares none of its own; it is the registry. Module manifests name the switches a
module reads (`module.json → switches`), and the app defines each one it uses in
`featureSwitches({ switches })`.

The module is the app's **switch provider** (`switchReader` of `@softure-ai/core`): a module that
this one depends on, and so cannot import it, reads its switch with `readSwitch(ctx, name)` from
core. For a switch defined here the reader answers its value (override, stored, default, fail mode;
one row read by name, no throw on a database failure); for any other name it answers `undeclared`,
and the module falls back to its own default.

Auth reads `auth.registration_closed` this way. Define it to close and open registration from the
panel, with `failMode: "open"` so a failed read keeps registration closed, and
`override: "towards-fail-mode"` so the variable can close registration but never reopen it:

```ts
import { REGISTRATION_CLOSED_SWITCH } from "@softure-ai/auth";

featureSwitches({
  switches: [
    {
      name: REGISTRATION_CLOSED_SWITCH,
      label: { en: "Registration closed" },
      default: false,
      failMode: "open",
      override: "towards-fail-mode",
    },
  ],
}),
```

The panel lists, under the switches, every switch an enabled module names in its manifest that
the app did not define here (with the module's id): those modules use their own defaults and
cannot be flipped from the panel. `listUndefinedManifestSwitches(config)` from `/server` returns the
same list for a script or a test.

## 8. Appearance

The panel is built from `@softure-ai/ui` (`Card`, `Switch`, `FormError`) and uses only its compiled
classes, so `@softure-ai/ui/styles.css` styles it and the `--sft-*` tokens theme it. `SwitchPanel`
takes `classNames` for its slots (`root`, `list`, `item`, `note`, `empty`, `undefined`) and `unstyled`,
and `undefinedSwitches` for the report of section 7 (the page passes it).

## 9. Copy

`featureSwitchesMessages.{en,pl}`: `panel` (title, lead, empty state, on/off, the report of
undefined switches), `source` (where the
value comes from: environment `{envName}`, stored `{date}`, default, fail mode) and `errors` for every
code the panel can show (`feature-switches.unknown_switch`, `auth.forbidden`, `core.*`). Override
any of them with `featureSwitches({ messages: { pl: { panel: { title: "…" } } } })`. Switch labels
and descriptions come from the definitions (section 3).

## 10. Hooks

None. Authorization is the auth role named by `panelRole`.

## 11. GDPR

The only user-related value is `updated_by`, the id of whoever set a switch last. The module
contributes to `@softure-ai/privacy` (`privacy` flags on):

- **Export** (`exportSwitchesUserData`): `lastSetSwitches`, the switches the user set last, with
  their value and date.
- **Deletion** (`deleteSwitchesUserData`): sets `updated_by` to null on those switches. The switch's
  value and `updated_at` stay: the switch belongs to the app, and deleting an account must not flip it.

Both helpers read only the database, so they take `{ db }` (`SwitchesPrivacyContext`, a drizzle handle
or a transaction): an app that runs account deletion in its own transaction, without
`@softure-ai/privacy`, calls them directly. `deleteSwitchesUserData` returns
`ok({ clearedSwitches })`, the number of switches whose `updated_by` it cleared, for the app's
deletion report.

## 12. Limitations

- No history: only the last change (when and by whom) is kept.
- Global switches only: no per-user, per-plan or percentage rollouts.
- Only one switch provider per app: a second module passing `switchReader` fails at startup.
- A read through `readSwitch` (another module's switch) is one row read per call, not cached per
  request like `isEnabled` from `/next`.
