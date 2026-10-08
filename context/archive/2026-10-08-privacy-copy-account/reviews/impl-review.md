# Implementation review: privacy-copy-account

Reviewed: the branch diff against plan.md (Phase 1, D1–D8) and issue #250.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `copyAccount(input)` with `from`, `to`, `userId`, `commit`, `exclude`, `include`, `onMissingReference`, exported
  from `@softure-ai/privacy/server` with its types (`modules/privacy/src/server/copy-account.ts`). Matches.
- D2: the catalog walk follows CASCADE, RESTRICT and NO ACTION keys from `auth.users`, skips self-references, adds the
  email-keyed consents and `include` roots; `exclude` drops a table and what only it reaches. Matches.
- D3: text in, typed casts out, `SET LOCAL` time zone and date style on both sides, one JSON parameter per table,
  generated columns skipped, unreferenced generated single-column keys left to the target in source key order,
  written identity keys with `OVERRIDING SYSTEM VALUE` and their sequence advanced (commit only). Matches.
- D4–D7: insert order over every foreign key between copied tables; the refusals as values with `detail`; read-back
  verification as a multiset over the written columns; the dry run rolled back by a sentinel after verification.
  Matches.
- D8: JSDoc, README section 1 bullet, section 11 "Copying an account to another database" with an app script, a
  section 12 limitation, CHANGELOG `## 0.1.9`. Matches.
- Tests: `modules/privacy/tests/copy-account.test.ts`, nine cases seen red before the code (the function did not
  exist), then green; a tenth case (cycle refusal) added in this review.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | JSON array elements were read with `r->>$n`: a bound parameter is typed `text`, so `->>` looked up an object key and every value came back NULL. The first test run showed it as a not-null violation on `auth.users.id`. | Fixed before the phase commit: the index is an inline integer literal. |
| 2 | Warning | `privacy.copy_unsupported` (a cycle) had no test. | Fixed: a test builds `folders` ⇄ `files` owning keys and asserts the refusal and its detail. |
| 3 | Suggestion | `privacy.copy_verification_failed` has no test: with the text round trip it cannot be produced against a real Postgres without patching the driver. | No change; the check stays as the guard the issue asks for (a silent precision loss). |
| 4 | Suggestion | A dry run consumes target sequence values for regenerated keys (sequences are not transactional). | No change; README section 11 says so. Sequences are only advanced (`setval`) on commit. |
| 5 | Check | The source is only read (`read only` transaction); the target is written only inside one transaction, kept only with `commit: true`. | No change. |
| 6 | Check | Identifiers are quoted by one helper; caller names in `exclude`/`include` are checked against the catalog before use; types come from `format_type`. | No change. |

## Gates

`npm run typecheck`, `npm run lint`, `npm run build` green; privacy tests 117 green; full `npm test` runs in the
pre-push hook.
