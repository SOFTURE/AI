---
change_id: core-money-negative-zero
status: open
---

# Plan: formatMoney never prints a minus on zero (issue #375)

Input: change.md, research.md. Complexity: small (one phase).

## Decisions

1. Unsigned `formatMoney` uses `signDisplay: "negative"`; `signed` keeps `"exceptZero"`.
2. Tests first: `-0` unsigned and rounded, a negative amount that rounds to zero, `-0` signed, compact `-0`, and a
   negative non-zero amount unchanged.
3. Docs: `FormatMoneyOptions.signed` comment and README "Display" say zero is never signed; CHANGELOG `## Unreleased`.

## Phases

### Phase 1: fix and tests

- `foundation/core/tests/format.test.ts`: new test "never puts a minus on zero"; run it red.
- `foundation/core/src/format.ts`: `signDisplay: options.signed === true ? "exceptZero" : "negative"`; doc comment.
- `foundation/core/README.md`, `foundation/core/CHANGELOG.md` (`## Unreleased`, #375).
- Gates: typecheck, lint, test.

## Progress

- [x] Phase 1: fix and tests (4330a73)
