# Research: privacy-registry

Sources: `foundation/core/src/module.ts` (contract), `modules/auth`, `modules/feature-switches`,
`modules/security`, `docs/02-module-standard.md` §3, §8, §9, `docs/01-module-assessment.md` row 8.
FIRE_TRACKER is not in this session's scope; its approach is summarised in the roadmap baseline
(hand-listed tables, deletion only from a CLI).

## 1. The contract already exists in core

`defineModule({ privacy })` takes a `PrivacyContributor` with optional `exportUserData(ctx, userId)`
and `deleteUserData(ctx, userId)`, and refuses a module whose functions do not match its manifest
flags (`privacy.exports`, `privacy.deletes`). Every `SoftureModule` carries `privacy` (or null).
So the registry needs no new core API: it walks `config.modules`, which `defineSoftureConfig`
already sorts by `dependsOn` (dependencies first). The app's own contributors cannot be modules
without a manifest, so they go in `privacy({ contributors: [{ id, exportUserData?, deleteUserData? }] })`.

## 2. Who holds user data today

| Module | Table | User data | Contributor |
| --- | --- | --- | --- |
| auth | `users` | id, email, password hash, dates | export id, email, dates (never the hash); delete the row |
| auth | `sessions`, `user_roles`, `password_resets` | `user_id` (cascade from users) | export dates and roles (never token hashes); deleted explicitly before the user row |
| feature-switches | `switches.updated_by` | the id of whoever set it last, no FK | export the switches the user last set; delete sets `updated_by = NULL` (the switch state stays) |
| security | `rate_limits.identifier` | only `subjectKey()` SHA-256 prefixes or client address keys, pruned after two windows | none; documented as short-lived pseudonymous counters |
| ops | none | none | none |

## 3. Unknowns from the roadmap

1. **Order of delete contributors with foreign keys across schemas.** App tables reference module
   tables (`public.user_profiles → auth.users`), and modules reference the modules they depend on.
   Deleting in the reverse of the export order (app contributors last to first, then modules from
   dependents to dependencies) always removes referencing rows first, whatever the FK action.
2. **Vetoes.** A contributor that must keep data returns an `Err` from `deleteUserData`; the
   transaction rolls back everything and the user gets `privacy.deletion_refused`. The contributor
   id and its code are logged (no user data). A contributor that must keep a record anonymises it
   instead (feature-switches does).
3. **Export size.** The export is built in memory; `privacy({ export: { maxBytes } })` (default
   10 MiB) bounds it, and an export over the limit is `privacy.export_too_large` rather than an
   unbounded response. Streaming is a later concern.

## 4. Confirmation and session cleanup

Deletion needs the current password (auth gains `isCurrentPassword(ctx, userId, password)`, a read
with no side effects) and an explicit "I understand" checkbox, and is rate-limited per user
(`privacy-delete`), so a stolen session cookie alone cannot delete an account and the form cannot
be used to guess a password. Sessions end with the account (auth's contributor deletes them), and
the action clears the cookie before it redirects. The export is rate-limited per user too
(`privacy-export`), since it reads every contributor.
