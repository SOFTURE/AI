---
change_id: db-testing-template-reuse-641
reviewed: 2026-10-21
verdict: approved
---

# Plan review: db-testing-template-reuse-641

Checked plan.md against change.md, research.md, issue #641, `testing.ts`, `drizzle.ts`, the lefthook preset.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Both proposal points (template once per run, cheaper reset) and the related pre-push point map to phases. | No change. |
| 2 | Major | A key built from hook object ids is meaningless in another process; reusing a template across files with a wrong key would hand a test the wrong schema. | Disk key only from content (files hashed) or an explicit `templateKey`; otherwise per-file cache as today. |
| 3 | Major | Truncating everything but the ledger drops rows migrations seed. | Restore the template's rows (all tables, ledger included) from blobs. |
| 4 | Major | Concurrent writers to the folder (several workers build the same template). | Temp file + rename; a duplicate build is wasted work, never a torn file. |
| 5 | Minor | A test that changes the schema would poison the pool. | Catalog fingerprint checked on every reuse. |
| 6 | Minor | `--cache` for ESLint asked as an option; unsound with typed rules. | Not adopted; reason recorded in change.md and the preset. |
| 7 | Check | Default behaviour unchanged without the setup and without `reuse`. | Existing `testing.test.ts` must pass untouched. |

No Critical findings.
