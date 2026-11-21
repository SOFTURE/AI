---
change_id: auth-invitations-fk-indexes
title: "auth: index the foreign keys of auth.invitations (issue #1420)"
status: open
roadmap_item: null
issue: 1420
branch: claude/project-thread-2ygda6
created: 2026-11-21
updated: 2026-11-21
---

## Intent

Every foreign key of the auth tables has an index that starts with its column, so deleting an account does not scan
`auth.invitations` to apply `ON DELETE SET NULL`, and an app with a "every foreign key is indexed" schema guard can
take auth past 0.2.19.

## Context

Issue #1420 (found adopting auth 0.2.20). Migration `0007_create_invitations.sql` added `invited_by` and
`accepted_user_id` (both `REFERENCES users (id) ON DELETE SET NULL`) without an index on either column.

## Scope

- A new forward-only migration `0008_index_invitations_foreign_keys.sql` with one index per column. 0007 is released
  and applied in apps, so it stays as it is.
- A test that every foreign key in the `auth` schema has an index starting with its column (the billing guard).
- README section 5, the schema comment, the example app's migration list, CHANGELOG.
- Release auth as a patch after the merge.

## Constraints

- No change to any app repository; the CHANGELOG says how to migrate.

## Notes

- frame skipped: the issue names the defect and the fix; no product question.
