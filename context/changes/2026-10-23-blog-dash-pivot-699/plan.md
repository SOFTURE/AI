---
change_id: blog-dash-pivot-699
status: in_progress
---

# Plan: dash-pivot catches a dash next to one number and a glued em dash (issue #699)

Input: change.md, research.md. Complexity: small (one rule, tests, docs).

## Phase 1: the rule (TDD) and docs

Files: `modules/blog/src/quality/rules/copy.ts`, `modules/blog/tests/quality/copy.test.ts`,
`modules/blog/tests/quality/pl/copy.test.ts`, `modules/blog/README.md`, `modules/blog/CHANGELOG.md`.

1. Tests first: a spaced dash with a number before only (`Up to 65 — after tax.`) and after only
   (`the gap — 65 years`) is a pivot; the issue's Polish sentences are pivots (in `tests/quality/pl/`); `word—word` is a pivot with the sample `word—word`;
   ranges stay clean: `2020 – 2024`, `Pages 10—12`, `20% – 30%`, `$10 – $20`.
2. Implement: skip a spaced match only when both neighbours are numeric (digit at the end before, at the start
   after, allowing non-letter symbols such as `%` or `$` beside the digit); one pattern with an alternative for an
   em dash between two letters (`\p{L}—\p{L}`), sample without spaces.
3. README row and `## Unreleased` in the CHANGELOG.

## Decisions (auto)

- A glued en dash (`Warsaw–Berlin`) stays allowed: it is the typographic relation dash, and the issue asks for the
  em dash only.
- A numeric side may carry a unit sign glued to the number (`20%`, `$10`), so those ranges keep passing. A unit
  as its own word (`10 USD – 20 USD`) is reported; such a range reads cleaner as `10–20 USD`.

## Progress

- [x] Phase 1: the rule and docs (SHA)
