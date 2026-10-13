---
change_id: auth-guard-relative-proxy-452
status: archived
---

# Plan: relative redirect inside Next's proxy (issue #452)

Input: change.md, research.md. Complexity: small (one branch of one function, tests, docs).

## Phase 1: absolute Location on the request origin (TDD)

Files: `modules/auth/src/proxy/index.ts`, `modules/auth/tests/guard.test.ts`, `modules/auth/tests/guard-next.test.ts`.

1. Tests first: a contract test that runs the guard through Next's `adapter()` for a signed-out request on a guarded
   path in both modes and expects 307 with a path-only `Location` for `relative` (red today: the adapter throws), plus
   an assertion that `new URL(location)` parses without a base. Update the relative-mode unit tests to expect
   `http://localhost:41234/login?next=…` (the request's origin, `X-Forwarded-Host` still ignored).
2. Implement: in relative mode return `Response.redirect(new URL(login.pathname + login.search, url.origin), 307)`.

## Phase 2: docs

The `redirect` option's doc comment, `modules/auth/README.md` (route guard paragraph), CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: absolute Location on the request origin (`3309c05`; contract test through Next's `adapter()` and three
  updated unit tests, five red before the fix)
- [x] Phase 2: docs (`80072f2`; option doc comment, README route guard paragraph, CHANGELOG `## Unreleased`)

Gates on the branch: `npm run typecheck` and `npm run lint` (pre-commit) green; auth guard tests 90 of 90; `npm run
build` and the full `npm test` (pre-push) run before the push.
