# Implementation review: next-actions-spike

Scope: full · Date: 2026-10-02 · Commits: 60d137f..HEAD · Gates: typecheck ✓ lint ✓ test ✓ · e2e ✓ (11 Playwright tests locally on Postgres 16)

## Verdict
Ready after fixes. An independent reviewer pass (read-only subagent) found no blocker, five warnings
and four suggestions. All are fixed in the review commit. W2 was a real gap in the verdict:
instrumentation alone does not fill the registry while `next build` prerenders, which docs/02 §8 now
says, with the measurement in research.md.

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | PASS | F4 |
| Scope | PASS | owned paths, one additive core export, docs |
| Progress honesty | PASS | F4 (fixed); 2.3 stays open until the workflow runs |
| Correctness | PASS | F2 (fixed, re-measured) |
| Tests | PASS | F3, F7, F8, F9 (fixed) |
| Data and migrations | PASS | one forward migration with a Rollback comment |
| Security | PASS | F6 (fixed: zod, length cap, fixture comment) |
| Architecture and patterns | PASS | F1, F5 (fixed) |
| Lessons | PASS | L-001: the client form hydrates from the packed `dist/` |

## Findings
- **F1 WARNING (fixed).** The action's comment said bound arguments are encrypted; they are plain text.
- **F2 WARNING (fixed).** The docs claimed instrumentation fills the registry during prerendering. Re-measured
  with the layout import removed: the build fails. Docs, core README, the registry error message and
  `instrumentation.ts` now say to import the config from the root layout too.
- **F3 WARNING (fixed).** The foreign-origin test passed on any 500. It now has a same-origin positive
  control that must return the echo, and the payload carries `$ACTION_KEY`.
- **F4 WARNING (fixed).** Progress was unticked.
- **F5 WARNING (fixed).** docs/02 said Next is always a peer dependency; it is one when the module imports it.
- **F6 SUGGESTION (fixed).** The spike's POST route now parses with zod and caps the text.
- **F7 SUGGESTION (fixed).** The action test asserts the exact registered `appOrigin`.
- **F8 SUGGESTION (fixed).** A test shows a tampered bound argument reaching the action.
- **F9 SUGGESTION (fixed).** The core test asserts a literal folder suffix.
