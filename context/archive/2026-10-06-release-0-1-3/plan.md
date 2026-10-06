# Plan: release-0-1-3

Input: change.md. Complexity: small (one phase).

## Phase 1: OIDC-only stage for existing packages and 0.1.3

**Discipline:** TDD for the workflow (repo test fails first); test-after for the bump.
1. Test: release.yml never maps `secrets.NPM_TOKEN` to `NODE_AUTH_TOKEN`, and exports it only in the
   branch for a package that is not on npm.
2. The stage step reads the secret as `NPM_TOKEN`, prints a notice for the path it takes, and exports
   `NODE_AUTH_TOKEN` only for a new package.
3. Bump the 16 packages to 0.1.3 as in `release-stage-tarball-path`; runbook and owner check updated.
4. Gates: typecheck, lint, test.

## Progress

- [x] Phase 1: OIDC-only stage and 0.1.3 (commit in this change's merge)
