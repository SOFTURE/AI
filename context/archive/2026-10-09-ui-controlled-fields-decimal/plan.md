---
change_id: ui-controlled-fields-decimal
status: archived
---

# Plan: controlled fields and parseDecimal (issue #320)

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases plus docs).

## Today (master `4af1614`)

- `foundation/ui/src/ui/amount.ts`: `AMOUNT_PATTERN` hard-codes a fraction of one or two digits; `parseAmount`
  computes `whole * 100 + fraction`; `formatAmountInput` splits cents with `% 100`. No other scale exists.
- `foundation/ui/src/ui/form-fields.tsx`: `TextField` and `MoneyField` render `defaultValue` from
  `useFieldValue(name, defaultValue)` and remount via `key` when a replay changes it. `MoneyField` rewrites the DOM
  value on blur with `normalizeAmountInput`. Neither takes `value` or a change callback.
- Tests: `amount.test.ts` pins the amount grammar and limits; `form-fields.test.tsx` pins markup and replay.

## Decisions

1. **One parser, any scale.** `parseDecimal` builds the whole-text pattern from the locale's grouped-whole part and
   a fraction of `1..scale` digits (none at scale 0), cached per locale and scale. Units are read by joining the
   digit strings (`whole + fraction padded to scale`) and calling `Number` once: exact up to 2^53 - 1, and every
   larger digit string reads as at least 2^53, so `isSafeInteger` is the range check.
2. **Own error codes.** `ui.decimal_invalid` / `ui.decimal_out_of_range`; `parseAmount` maps them back to the
   amount codes, so its callers and `getAmountErrorMessage` are unchanged.
3. **Scale bounds 0..15** (at 16 even "1" is past 2^53); a bad scale or `minFractionDigits` is a caller bug and
   throws a `RangeError` naming the value.
4. **`formatDecimal` trims to `minFractionDigits`** (default `scale`, so `formatAmountInput` keeps two decimals):
   percent fields want "12,5", amount fields "12,50".
5. **Controlled props as a discriminated union** (`FieldValueProps`): `value` requires `onValueChange` and forbids
   `defaultValue`. Uncontrolled fields may pass `onValueChange` to observe edits. A controlled `MoneyField` does not
   touch the DOM on blur; it reports the reformatted text through `onValueChange`. A controlled field ignores the
   form replay: its owner holds the value.
6. **No scale prop on `MoneyField`.** A percent or rate input is a controlled `TextField` with `inputMode` and a
   suffix plus `normalizeDecimalInput` on the caller's side; not asked for beyond that.

## Phase 1: parseDecimal and formatDecimal (TDD)

Files: `foundation/ui/src/ui/amount.ts`, `foundation/ui/tests/adoption-gaps-320.test.tsx`.

1. Tests first, red on master: scales 0, 1, 2, 3, 6; groups and signs per locale; too many fraction digits; the
   safe-integer edge; bad scale; `parseAmount` equals `parseDecimal` at scale 2; `formatDecimal` grouping, trimming,
   round-trip at `MAX_SAFE_INTEGER`; `normalizeDecimalInput`.
2. Implement; rewrite the amount functions on top.

## Phase 2: controlled fields (TDD)

Files: `foundation/ui/src/ui/form-fields.tsx`, the same test file.

1. Tests first (happy-dom, Testing Library): controlled `TextField` shows and reports edits, follows the parent's
   value; uncontrolled one reports edits; controlled `MoneyField` reports edits and the reformatted amount on blur,
   nothing for unparseable text; uncontrolled `MoneyField` still reformats in place.
2. Implement `FieldValueProps` and wire `value` / `onChange` / blur.

## Phase 3: docs and version

`foundation/ui/README.md` (export table, Forms section), `foundation/ui/CHANGELOG.md` under 0.1.16, version in
`foundation/ui/package.json` and `package-lock.json` (0.1.15 was released while the PR was open).

## Progress

- [x] Phase 1: parseDecimal and formatDecimal (tests red on master, green after)
- [x] Phase 2: controlled fields (17 of 18 new tests red on master; the uncontrolled MoneyField guard passes on both)
- [x] Phase 3: docs, CHANGELOG and version 0.1.16

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; ui tests 477 green; `npm test` runs
in pre-push.
