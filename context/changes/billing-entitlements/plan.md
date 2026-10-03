# Plan: billing-entitlements

Input: change.md, research.md. Complexity: medium (2 phases). Risk: medium.

## Goal

- `billing.entitlements` (migration 0001): `user_id` (PK, FK `auth.users` ON DELETE CASCADE),
  `trial_ends_at`, `paid_until` (nullable), `is_lifetime`, `created_at`, `updated_at`.
- Options: `trial: { days, reminderDays }`, `paid: { reminderDays }`, `routes: { payment }`.
- Pure core with a unit test per transition; `/server`, `/next`, `/ui` as in change.md.
- Example: `/account/billing` and `e2e/billing-entitlements.spec.ts` (a trial account writes, a
  read-only one cannot).

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Trial row | derived from `auth.users.created_at` until a change pins it | reads stay pure, hook stays free | research 1 |
| Lifetime | `is_lifetime` flag, exclusive with `paid_until` | `Date` has no infinity | research 2 |
| Trial end | start of the local day N days after the start day | people count days | research 3 |
| Guard | `requireWriteAccess` → `Ok` or `Err("billing.read_only")` | actions show the error | auth `authorizeRole` |
| Changes | `changeEntitlement` under a row lock | MO-2/MO-3 grant through it | AGENTS.md Data |

## Phase 1: Module

**Discipline:** TDD.

- Migration, schema, options, contract, entitlement core, messages, server, next, ui, manifest.
- Tests: every transition, calendar days across DST, server functions on PGlite, contributor,
  health, module options, components, messages, architecture.

## Phase 2: Example app, e2e, docs

- Example config and page, e2e spec; `migrations.spec.ts`, `ops.spec.ts`,
  `privacy-export-delete.spec.ts`, `scripts/container.mjs`; README sections 1 to 12.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [ ] 1.1 Entitlement core, server, contributor and health tests pass on PGlite
- [ ] 1.2 Component, messages and module tests pass; `module.json` equals the manifest
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Example app, e2e, docs

#### Automated
- [ ] 2.1 Example app builds; `e2e/billing-entitlements.spec.ts` and the touched specs pass
- [ ] 2.2 Gates green (typecheck, lint, test, build)
