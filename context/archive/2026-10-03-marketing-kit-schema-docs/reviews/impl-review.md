# Implementation review: marketing-kit-schema-docs

Scope: full · Date: 2026-10-03 · Commits: 79b198d..f5ab59e · Gates: typecheck ✓ lint ✓ test ✓ (2207 tests, 25 skipped) · build ✓

## Verdict
Ready. Every key of `marketing.schema.json` carries a description, the guard test names any key that loses one, and
validation is unchanged (no other test file edited, all marketing-kit tests green). Two findings: one gap outside this
change's scope deferred as FU-19, one accepted duplication of text.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | F2 (deferred, pre-existing) |
| Tests | PASS | - |
| Security | PASS (no entry point, no secrets) | - |
| Patterns and lessons | PASS | F1 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Guard test and descriptions for every key | f5ab59e | yes | small drift recorded in plan.md `## Decisions (auto)` |

Files: planned and changed 6 · unplanned 0 · planned, not changed 0. Context files (change, plan, roadmap, backlog)
are workflow bookkeeping.

## Findings

### F1 [SUGGESTION] Colour role texts live in two places
**Impact:** LOW · **Dimension:** Patterns · **Where:** `tools/marketing-kit/src/config/schema.ts` (`COLOR_ROLE_DESCRIPTIONS`), `tools/marketing-kit/src/config/colors.ts:6-25`
**What:** the role descriptions repeat the JSDoc on `COLOR_ROLES`. **Why it matters:** an edit to one can miss the
other. **Evidence:** both say "The touch ring and the end of the avatar's gradient." and the like.
**Fix:** move the record into `colors.ts` and drop the JSDoc there.
**Decision:** accept (auto): the plan placed the record in `schema.ts`, the schema's descriptions are what users read,
and moving it widens the change into `colors.ts`, which brand resolution owns; the texts are short and stable.

### F2 [WARNING] A later opening shot without `word` passes the config check and fails at compose time
**Impact:** LOW · **Dimension:** Correctness · **Where:** `tools/marketing-kit/src/config/schema.ts` (`hook.shots[].word`), `tools/marketing-kit/src/compose/compose.ts:208-211`
**What:** `word` is optional on every shot, but compose throws for any shot after the first without one. Writing the
description ("required on every shot after the first") surfaced it. **Why it matters:** the error arrives after the
recording, with an empty word in the message, not at the key to fix. **Evidence:** compose looks up
`shot.word` for `index > 0` and throws when no voiceover word matches.
**Fix:** a refinement in `videoSchema` on `hook.shots[i].word` for `i > 0`, with a config test.
**Decision:** defer: FU-19 (`marketing-kit-hook-shot-words`) in the followups roadmap; this change must not alter
validation (change.md Constraints, owner rule: gaps go to the catch-all roadmap).

## Progress audit
- 1.1: `tests/schema.test.ts` › `findUndescribedKeys` (two tests) green; the inline schema covers a bare key, a blank
  description, a bare key in a `oneOf` branch and a bare record value.
- 1.2: "describes the file and every key a project writes" green. Break check: removing the `fill.value` description and
  regenerating made it fail naming
  `/properties/videos/items/properties/beats/items/properties/actions/items/oneOf/3/properties/value`; restored.
- 1.3: drift test green after `npm run schema -w @softure-ai/marketing-kit`.
- 1.4: `git diff --stat master...HEAD -- tools/marketing-kit/tests` lists only `schema.test.ts`; marketing-kit tests
  298 passed, 14 skipped.
- 1.5: typecheck, lint (ESLint and language gate) and the full `npm test` re-run in this session; `npm run build` green.
- 1.6 (manual, owner): open; goes to the roadmap's owner checks at archive.

## Triage summary
Fixed: -. Accepted: F1. Deferred: F2 (FU-19). Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 Colour role texts in two places → accept (cheap but outside the planned files; stable texts).
- F2 Later opening shot without `word` → defer to FU-19 (validation changes are out of scope).
