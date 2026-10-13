---
change_id: core-percent-fraction-digits
status: archived
---

# Plan: fixed fraction digits in formatPercent (issue #455)

Input: change.md, research.md. Complexity: small (one option, one test file, docs).

## Phase 1: option (TDD)

Files: `foundation/core/src/format.ts`; test `foundation/core/tests/core-percent-fraction-digits-455.test.ts`.

1. Tests first, red on master:
   - `formatPercent(1900, "en", { fractionDigits: 2 })` is `19.00%`, `450` is `4.50%`; `fractionDigits: 1` with
     `signed` gives `+20.6%` for 2060 and `+3.0%` for 300; `fractionDigits: 0` gives `21%` for 2060.
   - Zero rule: `-0.4` and `-0` with `fractionDigits: 1` are `0.0%`, signed or not.
   - Works with `tight` and in pl (`19,00%`).
   - Without the option the output is unchanged (`12.5%`, `0.01%`).
   - `fractionDigits` of `-1`, `1.5`, `21`, `NaN` throws a `RangeError` naming the value.
2. Implement: validate, then pass `minimumFractionDigits`/`maximumFractionDigits`.

## Phase 2: docs

`foundation/core/README.md` (formatting section), `foundation/core/CHANGELOG.md` (`## Unreleased`).

## Progress

- [x] Phase 1: option (`c7c9cf8`; the new test file failed on master, 296 core tests green after)
- [x] Phase 2: docs (`a5fc2b3`)

Gates on the branch: typecheck, ESLint and the language gate green in pre-commit; the core package's 296 tests pass,
the full `npm test` runs in pre-push.
