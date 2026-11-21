# Research: auth-invitations-fk-indexes

## What exists

- `modules/auth/migrations/0007_create_invitations.sql`: `invited_by` and `accepted_user_id` reference `users (id)`
  `ON DELETE SET NULL`; the only indexes are `invitations_token_hash_key` (token_hash), `invitations_pending_email_key`
  (email, partial) and `invitations_created_at_idx` (created_at).
- The other auth foreign keys are already covered: `sessions.user_id` (`sessions_user_id_idx`), `user_roles` (primary
  key `(user_id, role)`), `password_resets` (primary key `user_id`), `identities` (unique `(user_id, provider)`).
- `modules/billing/tests/trials.test.ts` "billing's foreign keys": a `pg_constraint` / `pg_index` query asserting that
  every foreign key of the schema has an index whose first column is the key's column. The same query works for
  `auth`.
- `0004_index_users_created_at.sql` is the precedent for an index-only auth migration (comment, rollback note).
- `examples/next-app/e2e/migrations.spec.ts` lists every applied migration by module, version and name.
- The migrator takes the version and name from the file name (`NNNN_<name>.sql`).

## Options

- Full indexes on both columns (chosen): the column is mostly null for `accepted_user_id` before acceptance, but the
  table is small and a plain index matches the billing guard query exactly (`indkey[0]`), which a partial index also
  passes. Plain is simpler and serves the `invited_by` lookups of the privacy export too.
- Partial indexes `WHERE ... IS NOT NULL`: smaller, same guard result; not worth the difference at this size.
