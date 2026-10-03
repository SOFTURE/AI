# Plan: privacy-registry

Input: change.md, research.md. Complexity: medium (2 phases). Risk: high (deletion is irreversible).

## Goal

`@softure-ai/privacy` (no database schema of its own yet):

- `privacy({ contributors, export: { maxBytes } })`; app contributors `{ id, exportUserData?,
  deleteUserData? }`, validated (kebab-case id, at least one function, no duplicates);
  `PRIVACY_RATE_LIMIT_BUCKETS` (`privacy-export`, `privacy-delete`) for `security({ buckets })`;
- `@softure-ai/privacy/server`: `getPrivacyContributors(config)` (export order; throws when an app
  contributor reuses a module id), `exportUserData(ctx, userId)`, `deleteUserData(ctx, userId)`
  (one transaction, reverse order, a refusal rolls everything back), and the self-service
  `exportOwnData(ctx, { userId })` and `deleteOwnAccount(ctx, { userId, password, isConfirmed })`
  (rate limit, password, confirmation);
- `@softure-ai/privacy/next`: `PrivacyPage` (`requireUser`), `deleteAccountAction` (session first,
  clears the cookie, redirects to `afterDelete`), `exportRoute` (GET, JSON attachment, no-store);
- `@softure-ai/privacy/ui`: `DeleteAccountForm`;
- auth: `exportUserData` / `deleteUserData` contributor and `isCurrentPassword`;
  feature-switches: contributor (export the switches the user set, clear `updated_by`);
- messages en + pl; README (12 sections); auth and feature-switches README §11.

The example app enables `privacy()`, mounts `/account/privacy` and `/api/privacy/export`, links it
from `/account`, and `e2e/privacy-export-delete.spec.ts` downloads the export and deletes an account.

**Out of scope:** consents and the legal shell (EN-8), deletion by an admin or a CLI, streaming
exports, a grace period before deletion.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Registry | `config.modules` (already dependency-sorted) + `privacy({ contributors })` | core already holds the contract | research 1 |
| Delete order | reverse of export order: app contributors, then modules dependents-first | referencing rows go first | research 3.1 |
| Atomicity | one transaction; `Err` or throw rolls back | no half-deleted account | research 3.2 |
| Veto | contributor `Err` → `privacy.deletion_refused`, logged with contributor id | legal retention | research 3.2 |
| Export | one repeatable-read transaction, `maxBytes` bound | consistent and bounded | research 3.3 |
| Confirmation | current password + checkbox, per-user rate limit | stolen cookie is not enough | research 4 |

Rejected: a separate registry object the app calls `register()` on (a second source of truth next
to the config); cascading from `auth.users` only (misses tables without a FK, such as
`switches.updated_by`); deletion by email confirmation link (needs mailing, EN-1).

## Phase 1: Package, registry, export and deletion, contributors

**Discipline:** TDD (ordering, rollback and the schema scan are the risk).

- `modules/privacy/`: `package.json` (from `templates/package/`), tsconfigs, `module.json`,
  lockfile; `src/index.ts`, `src/options.ts`, `src/contract.ts`, messages en + pl.
- `src/server/`: options, contributors, export, deletion, self-service functions, rate limits.
- auth: contributor in `src/server/privacy.ts`, manifest flags, `isCurrentPassword`.
- feature-switches: contributor, manifest flags.
- Tests on PGlite: options, order, export content and size, deletion order with a FK-referencing
  fixture module and an app contributor, refusal rollback, the schema scan (no column in any
  schema holds the deleted user's id or email; another user's rows stay), self-service checks,
  auth and feature-switches contributors, module.json, messages.

## Phase 2: Next adapter, form, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/`: context, `exportRoute`, `deleteAccountAction`, `PrivacyPage`; `src/ui/delete-account-form.tsx`.
- Example: `softure.config.ts` (`privacy()` and its buckets), `app/account/privacy/page.tsx`,
  `app/api/privacy/export/route.ts`, link on `/account`, messages, dependency, lockfile, container
  and ops lists if they name modules.
- `e2e/privacy-export-delete.spec.ts`.
- READMEs, docs/02 where it describes the contract.

## Risks and rollback

- No migration; rolling back is reverting the commits.
- Deleting the wrong rows: every contributor deletes by the user id it is given, inside one
  transaction, and the schema scan test checks another user's rows survive.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, registry, export and deletion, contributors

#### Automated
- [ ] 1.1 Server tests (options, order, export, size, deletion order, refusal rollback, schema scan, self-service) pass on PGlite
- [ ] 1.2 auth and feature-switches contributors tested; `module.json` files equal their manifests
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Next adapter, form, example app and e2e

#### Automated
- [ ] 2.1 Form and architecture tests pass; gates green (typecheck, lint, test, build)
- [ ] 2.2 `npm run e2e` passes, including `e2e/privacy-export-delete.spec.ts`

#### Manual
- [ ] 2.3 Impl review recorded in `reviews/impl-review.md`
