# Research: switch-reader-contract

Sources: `foundation/core/src/{module,config,manifest}.ts`, `modules/auth/src/server/{switches,register}.ts`,
`modules/auth/src/next/pages.tsx`, `modules/feature-switches/src/{index,server/*,next/*}.ts`,
its README §7 and §12, `examples/next-app` (config, `e2e/feature-switches.spec.ts`,
`playwright.config.ts`), `docs/02-module-standard.md`.

## 1. What exists

- `defineModule(spec)` already carries optional runtime hooks next to the manifest: `privacy`
  (contributor) and `health` (probe). The enabled module (`SoftureModule`) exposes them as
  `privacy | null` and `health | null`; ops and privacy find them by walking `config.modules`.
- Auth declares `auth.registration_closed` in its manifest (`switches`) and reads it synchronously
  from `getAuthOptions(config).registrationClosed` with the env override
  `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED` (`true/1`, `false/0`, anything else closes and logs once).
  Three callers: `registerUser` (server), `LoginPage` (register link) and `RegisterPage`.
- Feature-switches depends on auth (`dependsOn: { auth }`, the panel's role check). Its value order
  is env override (`SOFTURE_SWITCH_<NAME>`, same variable name as auth's), stored row, default, with
  the fail mode on a read failure. `isEnabled(ctx, name)` in `/server` reads one row; `/next` reads
  every row once per request through React `cache`. Both throw for an undeclared name.

## 2. Unknowns from the roadmap

1. **Config registry or module manifest?** Neither a new registry nor the JSON manifest: the reader
   is a function, and the manifest is plain JSON (`module.json`). It goes where `health` and
   `privacy` already go: an optional `switchReader` in `defineModule`'s spec, exposed as
   `SoftureModule.switchReader` (`null` when absent). Core adds `readSwitch(ctx, name)` that asks the
   one enabled module providing a reader; `defineSoftureConfig` refuses two providers. Auth calls
   `readSwitch` from core, so it never imports feature-switches, and the dependency graph stays
   auth ← feature-switches.
2. **One read per request in Next?** The reader receives a `ModuleContext`, not request scope, so it
   cannot use React `cache` (`/server` code must also run in scripts). Each call reads one row by
   primary key. Per request auth asks once: the login page once (the register link), the register
   page once, the register action once. That is one cheap indexed read on pages that already read
   the session, so a per-request cache is not needed; the README says so.

## 3. The reading and the fallback

`readSwitch` returns a discriminated union: `{ kind: "value", isEnabled }` when a provider knows the
switch, `{ kind: "undeclared" }` when no module provides a reader or the provider has no definition
of that name. Auth's `isRegistrationClosed(ctx)` takes the value, else falls back to its option and
env override exactly as today. Feature-switches' reader never throws on a database failure (the
switch's fail mode applies), and returns `undeclared` instead of throwing for unknown names, since
modules legitimately ask switches the app chose not to define.

Fail mode: with the switch defined, a database failure gives the definition's `failMode`. `closed`
reads as off, which opens registration; the README recommends `failMode: "open"` for this switch
so a failed read keeps registration closed, matching auth's own fail-closed env handling.

## 4. The report of undefined manifest switches

Feature-switches can compute it from the config alone: every `manifest.switches` name of an enabled
module that is not in `featureSwitches({ switches })`. It is exposed as
`listUndefinedManifestSwitches(config)` in `/server` and shown in the panel under the list (name and
module, with a line saying the module uses its own fallback). The admin sees it where switches are
managed; nothing is logged on every request.

## 5. E2E

Closing registration in the shared e2e database would break every parallel test that registers.
Playwright project dependencies solve it: a second project runs `*.serial.spec.ts` files only after
the main project finished. The new spec flips `auth.registration_closed` in the panel, checks the
register page and the login link, and flips it back.
