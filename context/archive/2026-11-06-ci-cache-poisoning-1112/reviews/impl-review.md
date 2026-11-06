# Implementation review: ci-cache-poisoning-1112

Verdict: approved.

- Diff: `deploy-release-checks.yml` renames `prepare`'s output `ref` to `revision` (step output, job output, both
  checkouts) with a comment on why the commit is trusted; the repository test follows. No `workflow_call` input or
  output changed.
- Evidence: CodeQL CLI 2.27.4, `actions/cache-poisoning/poisonable-step`: 4 results on master (lines 284, 288, 320,
  324, alerts #52 to #55), 0 on the branch. The `actions-security-extended` suite: 19 results on master, 13 on the
  branch (the 4 above and 2 "checkout of untrusted code" on the same checkouts gone), none new.
- `npx vitest run tests/repo/deploy-workflows.test.ts`: 255 passed. Language gate clean.
