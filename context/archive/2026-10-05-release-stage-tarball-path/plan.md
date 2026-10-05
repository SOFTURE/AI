# Plan: release-stage-tarball-path

Input: change.md. Complexity: small (one phase).

## Phase 1: Local tarball path and 0.1.2

**Discipline:** TDD for the path (repo test fails first); test-after for the bump.
1. Test: every `npm (stage) publish "<path>"` line in release.yml starts with `./release-out/`.
2. `npm stage publish "./release-out/${TARBALL}"`.
3. Bump the 16 packages to 0.1.2 as in `release-0-1-1`; docs say why 0.1.0 and 0.1.1 have no release.
4. Gates: typecheck, lint, test.

## Progress

- [x] Phase 1: local tarball path and 0.1.2 (commit in this change's merge)
