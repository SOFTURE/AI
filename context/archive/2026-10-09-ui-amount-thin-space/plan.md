---
change_id: ui-amount-thin-space
status: archived
---

# Plan: parseAmount accepts the thin space (issue #303)

Input: change.md (research and framing skipped, reasons there). Complexity: trivial (one phase plus docs).

## Today (master `e13ae0c`)

- `foundation/ui/src/ui/amount.ts`: `SPACES = "[   ]"` is the one character class for group spaces. It
  feeds `AMOUNT_PATTERN` (both locales: `[1-9]\d{0,2}(?:SPACES\d{3})+`) and `GROUP_SEPARATOR` (the strip before the
  number is read). `MoneyField` and `normalizeAmountInput` call `parseAmount`.
- `text.trim()` already strips U+2009 at the ends; inside the number it fails the pattern.
- Tests: `foundation/ui/tests/amount.test.ts` pins U+00A0 and U+202F for `pl` and a plain space for `en`.

## Decisions

1. **Add ` ` to `SPACES`.** One edit covers the pattern and the strip in both locales, so the strict
   three-digit grouping applies unchanged.
2. **Nothing else.** Other Unicode spaces (U+2007 figure space, U+200A hair space) are not reported; widening to
   `\s` would also accept tabs and line breaks inside an amount.

## Phase 1: accept U+2009 (TDD)

Files: `foundation/ui/src/ui/amount.ts`, `foundation/ui/tests/amount.test.ts`.

1. Tests first, red on master: `pl` accepts `"1 234,56"`, `"12 345 678"` and a negative amount;
   `pl` refuses `"1 23,45"`, `"12 3456"` and a doubled thin space; `en` accepts `"1 234.56"` and
   refuses `"1 234,56"` (decimal comma).
2. Add ` ` to `SPACES` and its JSDoc.

Done when: the accepting tests fail on master and pass after; the gates are green.

## Phase 2: docs and version

Files: `foundation/ui/README.md` (the accepted separators after the `parseAmount` sentence),
`foundation/ui/CHANGELOG.md`, version in `foundation/ui/package.json` and `package-lock.json`.

## Progress

- [x] Phase 1: accept U+2009 (two new tests red on master, all 45 green after)
- [x] Phase 2: docs, version bump

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` runs in pre-push.
