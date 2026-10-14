# Implementation review: deploy-policy-docs

Scope: full · Date: 2026-10-14 · Commits: 0e17d51..0472de0 · Gates: lint ✓ (ESLint and language gate) · repository tests ✓ (516 passed, 43 skipped) · typecheck and package tests not affected (documents only)

## Verdict
Ready. `README.md`, `scripts/release/README.md`, `context/foundation/shape-notes.md` and the project part of
`AGENTS.md` now say a production deploy has the owner's standing approval (2026-10-14) and runs right after the
release. One finding, accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | - |
| Tests | PASS (docs only; links and roadmap contract green) | - |
| Security | PASS (no entry point, no secrets) | - |
| Patterns and lessons | PASS | F1 |
| Migrations | n/a | - |

## Findings

### F1 [SUGGESTION] The managed block still says a deploy waits for the owner
**Impact:** LOW · **Dimension:** Patterns · **Where:** `AGENTS.md` managed block (Operating mode, Releases)
**What:** the block installed by `@softure-ai/skills` keeps its generic rule. **Why it matters:** a reader who skips
the project section could hold a deploy back. **Fix:** the project section placed right above the block says it
overrides it, which the block itself allows; changing the generic rule belongs to the skills package.
**Decision:** accept (auto).

## Progress audit
- 1.1: diff of 0472de0 touches exactly the four documents listed in change.md plus this change folder.
- 1.2: the Done-when grep returns only the override sentence in `AGENTS.md` and the struck-through old no-go in
  `shape-notes.md`, both intended; lint and `vitest run tests/repo` green.

## Triage summary
Fixed: -. Accepted: F1. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 Managed block → accept (project rule overrides it).
