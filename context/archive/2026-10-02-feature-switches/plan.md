# Plan: feature-switches

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/feature-switches`:

- `featureSwitches({ switches, panelRole })`; definitions `{ name, label?, description?, default,
  failMode }`, validated (shape, duplicates, colliding env names);
- table `features.switches(name, enabled, updated_at, updated_by)` (migration
  `0001_create_switches.sql`), Drizzle table `switches`, health check;
- `@softure-ai/feature-switches/server`: `getSwitchDefinitions`, `isEnabled(ctx, name)`,
  `readSwitchStates(ctx)`, `listSwitches(ctx)`, `setSwitch(ctx, { name, enabled, actorId })`,
  `getSwitchEnvName`;
- `@softure-ai/feature-switches/next`: `isEnabled(name)` (one read per request), `SwitchesPage`
  (`requireRole(panelRole)`), `setSwitchAction` (`authorizeRole(panelRole)` first);
- `@softure-ai/feature-switches/ui`: `SwitchPanel` (client, ui `Switch` per row);
- messages en + pl; README (12 sections).

The example app enables the module with one switch (`example.welcome_banner`) shown on the home
page, mounts the panel at `/switches`, and `e2e/feature-switches.spec.ts` covers access and
flipping. `e2e/migrations.spec.ts` lists `feature-switches 1 create_switches`.

**Out of scope:** auth reading its switch through this module (follow-up), switch history,
per-user or percentage rollouts.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Definitions | declared by the app in options; module manifests only name switches | app owns safe defaults | research 2 |
| Value order | env → stored → default; fail mode on read error or bad env | roadmap fail mode | research |
| Caching | React `cache` per request in the adapter only | flips visible next request | research 1 |
| Audit | `updated_by` user id, no FK | v1 is enough | research 3 |
| Authorization | `dependsOn: auth`, `panelRole` checked by `requireRole` / `authorizeRole` | cannot mount unguarded | research |

Rejected: listing manifest-only switches (a toggle nothing reads); an `authorize` callback in
options (config would import Next code; the role check already fails closed); a cross-request cache
(stale after a flip on another instance).

## Phase 1: Package, table and server functions

**Discipline:** TDD (fail mode and defaults are the risk).

- `package.json` (from `templates/package/`), `tsconfig*.json`, `module.json`, lockfile.
- `migrations/0001_create_switches.sql`, `src/schema.ts`, `src/options.ts`, `src/index.ts`
  (`defineModule`, health), `src/contract.ts`, messages en + pl.
- `src/server/`: definitions, env override, `isEnabled`, `readSwitchStates`, `listSwitches`,
  `setSwitch`, health.
- Tests on PGlite: options, value order, fail mode, env override, set and audit columns, table
  constraints, health, module.json, messages.

## Phase 2: Next adapter, panel, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/`: context, `isEnabled`, `SwitchesPage`, `setSwitchAction`; `src/ui/switch-panel.tsx`.
- Example: `softure.config.ts` (append `featureSwitches(...)`), `app/switches/page.tsx`, banner on
  `app/page.tsx`, messages en + pl, `package.json` dependency, lockfile.
- `e2e/feature-switches.spec.ts`; `e2e/migrations.spec.ts` gains the new ledger row.
- README sections; follow-up entry in `context/backlog/identity-followups.md`.

## Risks and rollback

- Rollback of the migration: `DROP SCHEMA features CASCADE;` and the ledger row (in the SQL header).
- A wrong default locks an app: defaults are explicit per definition, and an env override fixes a
  bad stored value without the database.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, table and server functions

#### Automated
- [x] 1.1 Server tests (options, value order, fail mode, env override, set, constraints, health) pass on PGlite — 17a8efb
- [x] 1.2 `module.json` equals `toModuleJson(featureSwitches)` and the package passes `tests/repo/packages.test.ts` — 17a8efb
- [x] 1.3 Gates green (typecheck, lint, test) — 17a8efb

### Phase 2: Next adapter, panel, example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `feature-switches.spec.ts` — 341fe2b
- [x] 2.2 Gates green (typecheck, lint, test, build) — 341fe2b
