---
change_id: analytics-tagger-invalid-referer-702
status: planned
---

# Plan: the tagger passes a navigation with an unparsable Referer (issue #702)

Input: change.md, research.md. Complexity: trivial (one function, one test, a changelog line).

## Phase 1: fix (TDD)

Files: `modules/analytics/src/proxy/index.ts`, `modules/analytics/tests/tagger-scope.test.ts`,
`modules/analytics/CHANGELOG.md`.

1. Test first: a navigation with Referer `http://localhost:3000.example.com/?z=newsletter` returns `null` from
   `tag` (no targets, a list of targets, and a predicate that is not asked); a legacy-name rename with the same
   Referer still redirects. It fails on master with `TypeError: Invalid URL`.
2. In `tag()`: `if (channel === null) return null;` right after reading the channel; `source` becomes
   `referer !== null && URL.canParse(referer) ? new URL(referer) : url`.
3. CHANGELOG: an `Unreleased` entry describing the fix.

## Decisions (auto)

- One guard for both branches instead of keeping the rename special case: for a parsable Referer it gives the same
  `source` as before, and it does not rely on the comment's reasoning about where the channel came from.

## Progress

- [ ] Phase 1
