# @softure-ai/feature-switches

Runtime switches for a Next.js app: features turned on and off without a deploy, each declared once
with a default and a fail mode, overridable from the environment, and flipped by an admin in a
generic panel that is closed to everyone else. Built from FIRE_TRACKER's switches
(`src/db/feature-switches.ts`, `src/app/actions/{switches,manage-switches}.ts`,
`src/components/switch-manager.tsx`), with a declared registry instead of hard-coded names and the
panel behind a role from `@softure-ai/auth`.

## 1. What it provides

The table `features.switches`, the app's declared switches (`featureSwitches({ switches })`),
`isEnabled(name)` for server code (one read per request in Next, fresh in scripts), `setSwitch` with
`updated_at` and `updated_by`, an admin-only panel page and its server action, a `SwitchPanel`
client component, and a health check that `GET /api/health` of `@softure-ai/ops` runs.

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

To build your own panel, compose `SwitchPanel` from `@softure-ai/feature-switches/ui` with
`setSwitchAction` from `/next`, behind your own `requireRole` check.

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

## 6. Environment variables

The module requires none. Every declared switch can be overridden by
`SOFTURE_SWITCH_<NAME>`, where `<NAME>` is the switch name in upper case with `.` and `-` as `_`
(`billing.checkout_enabled` → `SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED`). `true`, `1`, `on` turn it on;
`false`, `0`, `off` turn it off; an empty value is no override. Any other value gives the fail mode
and logs the variable name once (never its value). While an override is set, the panel shows the
switch as held by the environment and disables its toggle. The override is the way back from a bad
flip that broke the panel itself.

## 7. Switches

The module declares none of its own; it is the registry. Module manifests name the switches a
module reads (`module.json → switches`), and the app defines each one it uses in
`featureSwitches({ switches })`.

`auth.registration_closed` is an exception for now: auth cannot read through this module (this
module depends on auth), so auth still reads its own `registrationClosed` option and
`SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`. Do not define it here until auth reads it through a
shared contract (follow-up in `context/backlog/identity-followups.md` of the SOFTURE AI repository):
the panel would show a toggle that auth ignores.

## 8. Appearance

The panel is built from `@softure-ai/ui` (`Card`, `Switch`, `FormError`) and uses only its compiled
classes, so `@softure-ai/ui/styles.css` styles it and the `--sft-*` tokens theme it. `SwitchPanel`
takes `classNames` for its slots (`root`, `list`, `item`, `note`, `empty`) and `unstyled`.

## 9. Copy

`featureSwitchesMessages.{en,pl}`: `panel` (title, lead, empty state, on/off), `source` (where the
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

## 12. Limitations

- No history: only the last change (when and by whom) is kept.
- Global switches only: no per-user, per-plan or percentage rollouts.
- `auth.registration_closed` is not read through this module yet (section 7).
- Switches a module names in its manifest but the app does not define are not listed or reported.
