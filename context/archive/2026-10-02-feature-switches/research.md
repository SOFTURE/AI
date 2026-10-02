# Research: feature-switches

Input: change.md, backlog-input.md. Depth: medium (a wrong default can lock an app). Sources:
`modules/auth` (ID-3, ID-4: roles, `isRegistrationClosed`), `foundation/core` (module contract,
manifest `switches`), `foundation/db`, `foundation/ui` (`Switch`), `modules/ops` (least-privilege
roles), docs/01 (source map), docs/02 §7 (switches), the example app.

FIRE_TRACKER was not read in this session: its clone was refused (no credentials for the private
repository in this container). What this change needs from it is in this repository: docs/01 lists
the source files and the gaps the module fills (a declared registry, a generic list UI, an admin
`authorize`), and auth's interim switch (`isRegistrationClosed`: declared default, env override,
fail closed on an unreadable value) is the behaviour baseline for overrides.

## Current state

- `modules/feature-switches/` is a stub: README and empty folders, no `package.json`.
- Core's manifest has `switches: string[]`, each prefixed with the module id
  (`auth.registration_closed`). docs/02 §7 shows the app declaring definitions:
  `featureSwitches({ switches: [{ name, default, failMode }] })`.
- Auth reads `auth.registration_closed` itself (option + `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`),
  synchronously, in its register page and action; its comment expects ID-6 to replace the lookup.
- Roles (ID-4): `requireRole` (404), `authorizeRole` (`auth.forbidden`), `ADMIN_ROLE`; an undeclared
  role throws.
- The app connects as `softure_app`; default privileges make a new module table usable without
  grants in the migration.

## Answers to the roadmap unknowns

1. **Caching of switch reads per request.** The Next adapter reads every stored row once per request
   (React `cache`), so many `isEnabled` calls in one render cost one query; nothing is cached across
   requests, so a flip is visible on the next request. The server API (`isEnabled(ctx, name)`) reads
   one row per call and has no cache: scripts and route handlers outside React get fresh values.
2. **How modules declare switches.** Names stay in the module manifest (`module.json → switches`,
   already in core); the definition (label, description, default, fail mode) is declared by the app
   in `featureSwitches({ switches })`, since only the app knows the safe default for its deploy.
   v1 lists in the panel exactly the switches the app defined. A switch a module declares in its
   manifest but the app did not define is not listed: listing it would show a toggle that nothing
   reads yet (below).
3. **Audit.** `updated_by` (the auth user id of the admin who flipped it) plus `updated_at` is enough
   for v1. No history table. No foreign key into `auth.users`: deleting an account must not change
   or delete a switch, and the id alone is not personal data once the account is gone.

## Further decisions

- **Value order:** env override → stored row → declared default. The fail mode decides the value
  when the stored state cannot be read (database error) or the env override is not a boolean:
  `failMode: "closed"` reads as off, `"open"` reads as on. Default fail mode is `closed`.
  An unreadable override is logged once by variable name, never by value (auth's pattern).
- **Env override name** is derived: `SOFTURE_SWITCH_` + the name in upper case with `.` and `-` as
  `_` (`auth.registration_closed` → `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`, auth's existing
  name). Two definitions that derive the same name are a configuration error. Values `true`/`1`/`on`
  and `false`/`0`/`off`.
- **Name shape:** `<scope>.<key>`, scope kebab-case, key snake_case, at most 100 characters; a
  `CHECK` repeats it in the table.
- **`setSwitch`** refuses an undefined name (`feature-switches.unknown_switch`) and upserts the row
  with `updated_at` and `updated_by`. It does not refuse while an env override is set (the stored
  value applies once the override is removed); the panel disables the toggle and says why.
- **Rows of switches no longer defined** are ignored, never deleted: removing a definition and adding
  it back keeps the last stored value.
- **Authorization.** The module depends on auth (manifest `dependsOn` and package dependency), so a
  config without auth fails at startup: the panel cannot be mounted without an authorization check.
  Option `panelRole` (default `admin`) names the role; the panel page calls `requireRole(panelRole)`
  and the action `authorizeRole(panelRole)` before reading the form. An undeclared role throws.
- **Auth's own switch.** Auth cannot import feature-switches (feature-switches depends on auth), so
  wiring `auth.registration_closed` to the stored value needs a switch-reader contract in core. That
  touches core and auth while ID-5 changes auth, so it is a follow-up
  ([`backlog/identity-followups.md`](../../backlog/identity-followups.md)); until then auth keeps its
  option and env override, and the example does not define `auth.registration_closed`.
- **Panel:** a server page lists every definition with its effective value, where the value comes
  from (environment, stored, default, fail mode) and when it was last changed; each row is a small
  client form with ui's `Switch` that submits on change through `useActionState`.
