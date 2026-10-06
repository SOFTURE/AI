# Plan: release-0-1-5

Input: change.md. Complexity: small (one phase).

## Phase 1: Direct npm publish, every package bumped

**Discipline:** TDD for the workflow (repo test fails first); test-after for the bump.
1. Test: release.yml has no `npm stage publish` and publishes the tarball with `npm publish`.
2. The npm job publishes directly; npm version check for trusted publishing (>= 11.5.1); notices and the
   GitHub Release notes no longer mention approval.
3. Bump 16 packages to 0.1.5, deploy and testing to 0.1.1 (and `deploy-cli-version`'s default).
4. Runbook, module standard, testing README and `roadmap-later.md` updated.
5. Gates: actionlint, typecheck, lint, test.

## Progress

- [x] Phase 1: direct npm publish, every package bumped (commit in this change's merge)
