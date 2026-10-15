# Implementation review: ui-suggested-amount-states

Scope: full · Date: 2026-10-15 · Commits: 4bd14c2 · Gates: typecheck ✓ · lint ✓ (ESLint and language gate) ·
test ✓ (7343 passed, 163 skipped, 482 files) · build ✓

## Verdict
Ready. `SuggestedAmountField` takes `suggestedValue: null`, `suggestionHint` (+ `suggestionHintProps`) and
`suggestionVariant="inline"` as issue #507 proposes; five new `suggestedAmount` messages carry every new text and are
overridable per call and through the provider. The #407 chip tests pass unchanged. One finding, accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS (fill, focus and replay paths shared by both variants) | - |
| Tests | PASS (null and missing, both hint names, inline row text, fill and focus, label override, copy overrides) | - |
| Accessibility | PASS (inline button named "Use {amount}", contains the visible "use"; hint names what it explains) | - |
| Patterns and lessons | PASS (slots, tokens, `getCopy`, package `Hint`) | F1 |
| Migrations | n/a | - |

## Findings

### F1 [SUGGESTION] The chip's top margin moved to the row
**Impact:** LOW · **Dimension:** Patterns · **Where:** `foundation/ui/src/ui/suggested-amount-field.tsx`
**What:** `sft:mt-2` is now on `suggestionRow`, not on `suggestion`. **Why it matters:** an app that overrode the
chip's margin through `classNames.suggestion` sees the row's margin added. **Fix:** none needed; the default look is
the same and the CHANGELOG names the move. **Decision:** accept (auto).

## Progress audit
- 1.1 to 1.3: 4bd14c2 changes the component, the messages, README and CHANGELOG and adds
  `tests/suggested-amount-field-507.test.tsx`.

## Triage summary
Fixed: -. Accepted: F1. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 accepted (documented in the CHANGELOG).
