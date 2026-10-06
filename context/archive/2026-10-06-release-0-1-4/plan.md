# Plan: release-0-1-4

Input: change.md. Complexity: small (one phase).

## Phase 1: Publishable deploy and testing, 0.1.4

**Discipline:** test-after (the repository tests check every workspace package's publishable shape).
1. Remove `"private": true` from `tools/deploy/package.json` and `foundation/testing/package.json`; the testing
   README no longer says it is unpublished.
2. Bump the 16 released packages to 0.1.4 as in `release-0-1-3`.
3. Runbook and `roadmap-later.md` (DP-8 status, owner check) updated.
4. Dry-run pack of both packages; gates: typecheck, lint, test.

## Progress

- [x] Phase 1: publishable deploy and testing, 0.1.4 (commit in this change's merge)
