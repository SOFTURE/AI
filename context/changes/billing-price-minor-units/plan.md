# Plan: billing-price-minor-units

Input: change.md, research.md. Complexity: small.

## Goal

- `getMinorUnitDigits` reads a table billing pins: ISO 4217 List One (2024-06-25) without funds and
  `N.A.` units, MGA overridden to 0, XCG added. HUF and TWD are 2, ISK and JPY 0, KWD and IQD 3, ALL 2,
  on every runtime.
- `formatPrice` keeps `Intl`'s notation but prints exactly the table's digits, so `amount: 2950` is
  HUF 29.50 whatever the runtime's CLDR says.
- `isSupportedCurrency` is "the table has it": a code a runtime lists but ISO withdrew (HRK, SLL)
  is refused when the config loads, and a current code is accepted on a runtime that lacks it.
- Stripe's conversion follows the table (ALL, RSD, LAK ... go unchanged; ISK and UGX ×100; MGA and the
  rest of Stripe's zero-decimal list unchanged).
- A test fails if the pinned table and the runtime disagree in a way that changes a price: for every
  pinned currency, the runtime's formatter, given the table's digits, prints exactly that many decimals
  of the amount.

**Out of scope:** a script that regenerates the table from ISO (one constant, edited by hand when ISO
amends it); FU-33 and later lane C items.

## Approach

**Starting point:** `getMinorUnitDigits` reads `resolvedOptions().maximumFractionDigits` and
`isSupportedCurrency` reads `Intl.supportedValuesOf("currency")` (`src/price.ts:20-27`);
`stripe-currency.ts:32-34` derives its shift from `getMinorUnitDigits`.

**Chosen:** research option A. A new `src/currency-digits.ts` holds `CURRENCY_MINOR_UNIT_DIGITS`
(a frozen record, codes grouped by digits, source and date named, the override and the addition
commented). `price.ts` reads it; the formatter is created with `minimumFractionDigits` and
`maximumFractionDigits` set to the table's digits. Rejected: a CLDR snapshot (B), a start-up check
against `Intl` (C).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Base | ISO 4217 List One 2024-06-25 | the standard, matches Stripe for 11 of the 13 CLDR disagreements | research F2, F3 |
| Override | MGA → 0 | non-decimal subunit; CLDR and Stripe both say 0 | research F4 |
| Addition | XCG → 2 | in circulation since 2025-03-31, after the list | research F6 |
| Left out | funds, `N.A.` units, UYW (a wage index unit, the list's only 4-digit code) | not prices | research F6, plan review S1 |
| Unknown code | `getMinorUnitDigits` throws (charging or converting it is a bug: the config refuses it); `formatPrice` of a stored row in a code outside the table falls back to `Intl`'s own digits, so an admin page never breaks on history | never guess money's unit when charging; display stays up | plan review W1 |
| Exports | `getMinorUnitDigits`, `isSupportedCurrency`, `formatPrice` keep their signatures; the table is exported read-only | apps and tests can list currencies | plan |

## Phase 1: Pinned minor units

**Discipline:** TDD. **Files:** `src/currency-digits.ts` (new), `src/price.ts`, `src/stripe-currency.ts`
(comments only), `src/options.ts` (message), `src/index.ts`, `tests/price.test.ts`,
`tests/stripe-currency.test.ts`, `tests/stripe.test.ts`, `README.md`

1. Tests first: pinned digits for HUF, TWD, ISK, UGX, JPY, KWD, IQD, ALL, MGA, XCG; `formatPrice`
   of HUF 2950 is "HUF 29.50" and ALL 150000 is "ALL 1,500.00"; HRK and SLL unsupported, XCG supported; `getMinorUnitDigits("HRK")` throws while `formatPrice` of
   an HRK amount still formats (W1); every table entry is an upper-case code with 0, 2 or 3 digits (S1);
   for every pinned currency, the formatted amount has exactly the table's decimals (the runtime
   agreement test); Stripe: ALL/RSD sent unchanged, ISK/UGX ×100, MGA unchanged, IQD refused unless it
   ends in 0; HUF/TWD tests stop deriving from the runtime.
2. `src/currency-digits.ts`: the table and its comment.
3. `src/price.ts`: digits from the table (throw on an unknown code), the formatter with fixed digits
   (an unknown code formats with `Intl`'s defaults, W1), `isSupportedCurrency` from the table; header
   comment rewritten.
4. `stripe-currency.ts` and its tests: comments say billing's unit is the pinned table; the loop over
   `Intl.supportedValuesOf` iterates the table instead.
5. `options.ts`: the currency message says "a currency billing knows (ISO 4217)".
6. README: the plan section states the pinned unit, lists the currencies whose meaning differs from
   `Intl`'s on current runtimes (AFN, ALL, IRR, KPW, LAK, LBP, MMK, RSD, SOS, SYP, YER ×100; IQD ×1000;
   HUF and TWD on older runtimes) and how to convert; the Stripe section loses "`Intl`'s unit".

## Risks and rollback

- A deployer's config written on a runtime with other digits now means a different amount: stated in
  the README; billing is unpublished (MO-6 release pending), so no released config is affected.
- Rollback: revert the commit; no migration, no stored data changes shape.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Pinned minor units

#### Automated
- [ ] 1.1 Digits come from the pinned table (HUF/TWD 2, ISK/JPY/MGA 0, KWD/IQD 3, ALL 2, XCG 2)
- [ ] 1.2 `formatPrice` prints the table's digits on any runtime; the runtime agreement test covers every pinned currency
- [ ] 1.3 The config accepts exactly the pinned codes (HRK, SLL refused)
- [ ] 1.4 Stripe amounts follow the table (ALL unchanged, ISK ×100, IQD refused unless it ends in 0)
- [ ] 1.5 Gates green (typecheck, lint, test, build)
