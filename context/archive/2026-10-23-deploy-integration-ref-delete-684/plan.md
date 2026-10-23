---
change_id: deploy-integration-ref-delete-684
status: archived
---

# Plan: integration ref deletion through git/refs (issue #684)

Input: change.md, research.md. Complexity: small (one workflow step).

## Phase 1: fix the endpoint (TDD)

Files: `tests/repo/deploy-workflows.test.ts`, `.github/workflows/deploy-integration.yml`.

1. Test first: the `gh` stub answers like the API (success only for `--method DELETE
   repos/acme/app/git/refs/heads/...`, "Not Found (HTTP 404)" otherwise); the test asserts the exact arguments for the
   default and a custom prefix, that a ref outside the prefix makes no call, and keeps the 422 and 403 cases.
2. Fix: `git/refs/${GITHUB_REF#refs/}`.

## Phase 2: changelog

`## Unreleased` in `tools/deploy/CHANGELOG.md`: the fix, and that an app deletes the stale `integration/*` refs it
already has.

## Decisions (auto)

- The "e2e assertion" the issue suggests becomes an API-shaped stub in the repository test (research.md, option 1):
  no end-to-end run of this workflow exists, and adding one would write refs into this repository on every run.

## Progress

- [x] Phase 1: fix the endpoint (493581d)
- [x] Phase 2: changelog (0f1d31c)

Tests were written before the fix in phase 1 (the new test failed with "Not Found (HTTP 404)" on the old path).
