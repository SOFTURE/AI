---
change_id: deploy-verify-header-starts-with-441
status: archived
---

# Plan: deploy verify header startsWith (issue #441)

Input: change.md, research.md. Complexity: small.

## Phase 1: schema and checks (TDD)

Files: `tools/deploy/src/verify/{schema,checks}.ts`, tests `schema.test.ts`, `checks.test.ts`,
`schema/deploy.schema.json` (regenerated).

1. Tests first: the schema keeps `{ startsWith }` alone and inside a list; refuses an empty `startsWith`, an unknown
   key and an empty object. Checks: an anchored value passes case-insensitively (`starts with "..."`), the same text
   later in the value fails (`expected to start with`), a missing header fails, and a plain string still passes on a
   substring.
2. Implement: a `headerMatchSchema` union item (string or strict `{ startsWith }`) used alone and in the list; a
   `startsWith` branch in `checkHeader`.

## Phase 2: docs

README verify "Headers" bullet with the `signature-input` example; CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: schema and checks (`810a20a`; 4 tests written first, schema file regenerated)
- [x] Phase 2: docs (`6a2941d`; README "Headers" bullet with the `signature-input` example, CHANGELOG `## Unreleased`)
