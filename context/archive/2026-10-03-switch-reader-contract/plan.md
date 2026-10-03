# Plan: switch-reader-contract

Input: change.md, research.md. Complexity: medium (2 phases). Risk: high (roadmap), contained by
the fallback: nothing changes for an app that does not define the switch.

## Goal

- `@softure-ai/core`: `SwitchReading` (`{ kind: "value", isEnabled } | { kind: "undeclared" }`),
  `SwitchReader = (ctx, name) => Promise<SwitchReading>`, `defineModule({ switchReader })`,
  `SoftureModule.switchReader` (`null` when absent), `readSwitch(ctx, name)`; `defineSoftureConfig`
  refuses a second provider; `defineModule` refuses a non-function.
- `@softure-ai/feature-switches`: provides `switchReader` (declared → value with its usual order
  and fail mode, never throws on the database; undeclared → `undeclared`);
  `listUndefinedManifestSwitches(config)` in `/server`; the panel lists them with copy in en/pl.
- `@softure-ai/auth`: `isRegistrationClosed(ctx, env?)` becomes async and asks `readSwitch` first,
  falling back to the option and env override; the register action and both pages await it.
- Example app: defines `auth.registration_closed` (failMode `open`); a Playwright project for
  `*.serial.spec.ts` runs after the main one; `e2e/registration-switch.serial.spec.ts`.
- READMEs of core, auth and feature-switches; `docs/02-module-standard.md` names the new hook.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Registration of the reader | optional `switchReader` in the module spec | same shape as `health` and `privacy`; manifest is JSON | research 2.1 |
| Several providers | config error | one source of truth per switch | research 2.1 |
| Unknown name at the provider | `undeclared`, not a throw | modules ask switches the app may not define | research 3 |
| Per-request caching | none; one indexed read per call | no request scope in `ModuleContext` | research 2.2 |
| Report | `/server` function plus a panel section | visible where switches are managed | research 4 |
| E2E isolation | dependent Playwright project for `*.serial.spec.ts` | closing registration must not race other specs | research 5 |

Rejected: auth importing feature-switches (cycle); a global mutable registry in core (a config
already lists the modules); logging the report at startup (noise in every process, scripts too).

## Phase 1: Contract, provider, auth

**Discipline:** TDD.

- core: `src/switches.ts`, spec and module field, config check, exports, tests.
- feature-switches: reader in `src/server/reader.ts`, wiring in `src/index.ts`, report function,
  panel section and messages; tests including auth's `registerUser` refused through a stored row.
- auth: async `isRegistrationClosed(ctx)`, callers, tests (fallback unchanged; provider value wins).

## Phase 2: Example app, e2e, docs

- Example config, Playwright project, the serial spec.
- READMEs and the module standard.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Contract, provider, auth

#### Automated
- [x] 1.1 Core, feature-switches and auth tests pass, including registration closed by a stored row — 0d17c24
- [x] 1.2 Gates green (typecheck, lint, test) — 0d17c24

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — 5e57620
- [x] 2.2 `npm run e2e` passes, including `e2e/registration-switch.serial.spec.ts` — 5e57620

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — 5e57620
