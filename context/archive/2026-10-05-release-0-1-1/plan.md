# Plan: release-0-1-1

Input: change.md. Complexity: small (one phase).

## Goal

Every public package at 0.1.1 on `master`, all gates green, ready for `auto-release` with `all`.

## Phase 1: Version bump

**Discipline:** test-after (the module tests compare inline manifests with module.json; the repo tests
check ranges and the tag plan).
1. `npm version 0.1.1 --no-git-tag-version -w <package>` for the 16 packages (package.json + root lock).
2. module.json and inline manifests to 0.1.1; README status lines; runbook and roadmap owner check.
3. `examples/next-app/package-lock.json` refreshed from the built packages.
4. Gates: typecheck, lint, test.

## Progress

- [x] Phase 1: version bump (commit in this change's merge)
