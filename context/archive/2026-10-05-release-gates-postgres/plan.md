# Plan: release-gates-postgres

Input: change.md. Complexity: small (one phase).

## Goal

The "validate and pack" job of `release.yml` carries ci.yml's test setup (Postgres service, its URL,
the runner's Chrome path), so `npm test` passes there as it does in ci.yml.

**Out of scope:** re-releasing 0.1.0 (owner's decision, change.md Notes); the Stripe sandbox test in
releases.

## Approach

**Chosen:** copy the service and env of ci.yml's test job into the validate job, guarded by a repo test
that reads both workflow files and requires the same setup lines. Rejected: skipping the CI guard tests
in releases (never skip a test); dropping "Gates" from releases (a tag can point at any commit).

## Phase 1: Release job test setup

**Discipline:** TDD (the repo test fails first).
**Files:** `tests/repo/release-workflow.test.ts`, `.github/workflows/release.yml`.

1. Test: each setup line (Postgres URL, Chrome path, image, health check) is in ci.yml and in release.yml.
2. Add the service and env to the validate job.
3. Gates: typecheck, lint, test (pre-push).

## Progress

- [x] Phase 1: release job test setup (commit in this change's merge)
