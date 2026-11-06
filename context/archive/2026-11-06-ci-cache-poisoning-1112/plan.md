---
change_id: ci-cache-poisoning-1112
status: archived
---

# Plan: close the cache poisoning alerts (issues #1112 to #1115)

Input: change.md, research.md. Complexity: small (one workflow, its repository test).

## Phase 1: workflow and test

Files: `.github/workflows/deploy-release-checks.yml`, `tests/repo/deploy-workflows.test.ts`.

- `prepare`'s step `commit` writes `revision=` (no tag) or `revision=<sha>` (tag) instead of `ref=`; the job output
  `ref` becomes `revision`; `static` and `unit` check out `needs.prepare.outputs.revision`.
- A comment at the output says the value is the caller's commit or a tag commit proven on the release branch.
- Tests: the expected step output and the checkout `ref` follow the rename.

Evidence: CodeQL CLI with the same query on the branch returns no result (it returns four on master); `npm run
typecheck`, `npm run lint`, `npx vitest run tests/repo/deploy-workflows.test.ts`.

## Phase 2: after the merge

The next CodeQL scan of master closes alerts #52 to #55, and `security-alerts.yml` closes the issues. Verified through
the issues' state (the alert API answers 403 to this session).

## Decisions (auto)

- Option 1 of research.md (rename), not a dismissal by the owner.

## Progress

- [x] Phase 1: workflow and test (CodeQL 4 -> 0 results; deploy-workflows.test.ts 255 passed)
- [x] Implementation review
- [ ] Phase 2: alerts closed after the merge
