---
change_id: config-merge-push-scope-868
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (b3faae2).

- Acceptance of #868: merge-only push → typecheck, ESLint, language, related tests (phases 1-2); incoming migration,
  dependency, setup or config → full suite (phase 1 list); new branch code, no upstream, git error → full (phase 1);
  `softure-context-only-push` untouched (phase 2 only adds a skip entry to `test`).
- Safety: every unknown is `full`; a crashed bin exits non-zero, so `is-merge` never skips the full suite by accident,
  and `is-full` failing only adds a related run.
- Commits of the main branch in the range are excluded before the per-commit check, so incoming main-branch code does
  not count as branch code; the merge's own resolution is covered by the branch's related tests plus typecheck and
  ESLint on the whole tree.
- Gap found: a merge that brings in a deletion of a file the branch imports is caught by typecheck, not tests; fine.
- Docs carry the migration (an app on the preset gets it by upgrading; an app with its own `test` override must add
  the skip entry itself).

Verdict: approved, no changes.
