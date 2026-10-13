---
change_id: deploy-verify-warn-on-434
status: archived
---

# Plan: deploy verify warnOn (issue #434)

Input: change.md, research.md. Complexity: small.

## Phase 1: schema and runner (TDD)

Files: `tools/deploy/src/verify/{schema,run-checks}.ts`, tests `schema.test.ts`, `run-checks.test.ts`,
`schema/deploy.schema.json` (regenerated).

1. Tests first: schema keeps `warnOn`; refuses an empty list, a duplicate, the route's own status, a status out of
   100–599. Runner: a listed status gives one `status` check reading `status 404 (warnOn)`, `passed: false`,
   `severity: "warn"`, other checks skipped; an unlisted mismatch (200 text/html where JSON belongs, 500) keeps
   `severity: "fail"`; the expected status passes as before; a `forEach` source answering a listed status is a warn row.
2. Implement: `warnOn` strict object in `routeSchema` with a refinement; in `checkRoute` and `expandRoute`, a listed
   status returns a warn row.

## Phase 2: docs

README verify section (a bullet next to Severity, with the key-directory example); CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: schema and runner (`eb8849e`; 6 tests written first, schema file regenerated)
- [x] Phase 2: docs (README bullet with the key-directory example, CHANGELOG `## Unreleased`)
