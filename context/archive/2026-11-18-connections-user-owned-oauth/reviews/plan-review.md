# Plan review: connections-user-owned-oauth

Verdict: approve.

- Contract: `ownerId` is optional everywhere and `null` means the app, so existing callers and stored rows keep their
  meaning; the migration only adds nullable columns and swaps one unique index for two partial ones that hold the same
  rows (all existing rows have `owner_id` null).
- Migration: forward only, rollback written in the file; the upserts name the partial index with `targetWhere`, which
  Postgres needs to pick a partial unique index for `ON CONFLICT`.
- Security: the owner always comes from the session in the Next adapter, never from the form; an owned state can only
  be completed by its creator (`owner_id = created_by` check), and an admin's state never by `ownOnly`.
- Tests: each new refusal has a case; the sealing binding is shown by moving a row to another owner.
