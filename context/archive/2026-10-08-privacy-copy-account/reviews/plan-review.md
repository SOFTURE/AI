# Plan review: privacy-copy-account

Reviewed: plan.md against change.md, research.md, issue #250, `modules/privacy/src/server/{collect,erase,consents-contributor}.ts`,
the module migrations listed in research.md and `foundation/db/src/{client,testing}.ts`.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | D2 builds SQL from catalog names (`schema.table`, columns, types). They come from the source database, not the caller, but `exclude` / `include` do come from the caller and a name with a quote or a dot inside an identifier would break the SQL. | Identifiers are always quoted (`"` doubled) by one helper; `include` / `exclude` names are matched against the catalog and an unknown name is `copy_schema_mismatch`, so no caller text reaches the SQL as such. Types go through `format_type` from the catalog only. |
| 2 | Warning | D6 must compare against the rows as written, not as read: with `onMissingReference: "null"` a nulled key differs from the source on purpose, and generated keys left to the target are not comparable. | Verification compares the written column set of the written rows. |
| 3 | Warning | D3 regenerated identity keys: `privacy.consents` ordering ties (`recordedAt`, `id`) must survive. | Rows are inserted ordered by the source key, so new ids keep the relative order. Test 2 covers two consents. |
| 4 | Suggestion | An `IN (SELECT ...)` over a nullable owning key (e.g. `consents.user_id` for email rows) never matches NULL, which is right; the email-key rows come from the built-in OR branch. | No change; test 1 asserts both consent kinds. |
| 5 | Suggestion | The account-exists check (D5) and the insert run in one target transaction; a concurrent registration of the same email between them still hits `users_email_key` and maps to `copy_conflict`. | No change. |
| 6 | Check | Never writes to the source: the source transaction is `read only`. Dry run rolls back by a private sentinel error, the same pattern as `erase.ts`. | No change. |
| 7 | Check | Lessons: features are TDD; English only; no core contract change (constraint in change.md). | No change. |

No migration, no API removal, no cross-package impact (additive export of `@softure-ai/privacy/server`).
