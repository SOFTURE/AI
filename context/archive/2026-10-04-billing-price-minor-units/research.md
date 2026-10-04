# Research: billing-price-minor-units

Question: which digits should billing pin for each currency's minor unit, and what changes for
formatting, validation, Stripe and deployers when it stops asking the runtime's `Intl`?

## Sources

| Source | What it gives |
| --- | --- |
| ISO 4217 List One, published 2024-06-25 (the `list-one.xml` that the npm package `currency-codes` 2.2.0 ships; the ISO maintenance agency's own URL is not reachable from this session) | 179 codes: minor units 0, 2, 3 or 4, `N.A.` for metals and special units, `IsFund` on fund codes |
| Node 22.22.0 here (ICU 77.1, CLDR 47.0) | `Intl.supportedValuesOf("currency")`: 162 codes, digits from `resolvedOptions().maximumFractionDigits` |
| FU-25 CI run (the runner's Node 22, an older ICU) | HUF had 0 digits there and 2 here |
| `modules/billing/src/stripe-currency.ts` (FU-25) | Stripe's zero- and three-decimal lists; 2 digits otherwise |

## Findings

**F1. The runtime is not a stable source.** The same Node major (22) gives HUF 0 digits on one build
and 2 on another; `Intl.supportedValuesOf("currency")` also differs by build (it lists HRK, SLL and
ZWL here, codes ISO has withdrawn). So both the digits and the set of accepted codes move with the
runtime, and today they move a plan's price by ×100.

**F2. ISO 4217 and CLDR 47 disagree on 13 currencies** (ISO digits / `Intl` digits here):

| Currency | ISO | `Intl` here | Stripe |
| --- | --- | --- | --- |
| AFN, ALL, IRR, KPW, LAK, LBP, MMK, RSD, SOS, SYP, YER | 2 | 0 | 2 |
| MGA | 2 | 0 | 0 (zero-decimal list) |
| IQD | 3 | 0 | 2 |

Every other code ISO and `Intl` both know agrees (HUF and TWD are 2 in both here; ISK and UGX are 0
in both). CLDR's zeros are display practice ("no decimals in use"), not the currency's definition.

**F3. Stripe already sits on ISO's side.** With ISO digits, the eleven ISO-2/`Intl`-0 currencies need
no conversion for Stripe at all (2 = 2), where today they are sent ×100. ISK and UGX are still ×100
(ISO 0, Stripe 2). MGA would be the one currency where ISO (2) and Stripe (0) disagree; IQD needs an
amount ending in 0 (3 → 2), refused by the existing `checkPrice` otherwise.

**F4. MGA's minor unit is not decimal.** One ariary is five iraimbilanja; ISO writes 2 by convention,
CLDR writes 0 and Stripe charges it without a minor unit. Pinning 0 makes billing agree with how it
is charged and shown, and keeps every currency in Stripe's zero-decimal list at 0 digits in billing.

**F5. `Intl` honours explicit digits.** `new Intl.NumberFormat(locale, { style: "currency", currency,
minimumFractionDigits: d, maximumFractionDigits: d })` prints exactly `d` decimals for any code,
including one it does not know ("XYZ 29.50"). So formatting can stay on `Intl` (symbols, separators,
the currency's position) while the digits come from the table: the runtime can no longer change the
amount, only its notation.

**F6. Codes ISO lists but nobody pays in.** Funds (`IsFund`: BOV, CLF, COU, MXV, CHE, CHW, USN, UYI)
and `N.A.` units (XAU, XDR, XTS, XXX ...) are not prices. XCG (Caribbean guilder, 2 digits) replaced
ANG on 2025-03-31 and is later than the 2024-06-25 list; `Intl` here already knows it.

## Options

- **A. ISO 4217 table, one override (MGA → 0), XCG added; format through `Intl` with the table's
  digits; `isSupportedCurrency` reads the table.** One source for validation, formatting and Stripe;
  F3 makes Stripe simpler for eleven currencies. Changes the meaning of `amount` for the thirteen F2
  currencies against CLDR 47 (and for HUF/TWD against older runtimes), which the README states.
- **B. Snapshot of CLDR 47's digits.** Keeps today's meaning on this runtime, but pins display
  practice rather than the standard, disagrees with Stripe on eleven currencies, and CLDR has already
  changed HUF once.
- **C. Keep `Intl`, fail at start-up when it disagrees with a table.** Turns a silent ×100 into a
  refusal but leaves the deployer at the mercy of the runtime; no stable meaning.

Recommendation: **A**.

## Telling deployers

`@softure-ai/billing` has not been published yet (MO-6, the owner's batch release on 2026-10-05), so
no deployer has a config written against a released unit. The README states the
pinned unit, lists the currencies whose meaning differs from `Intl`'s on current runtimes, and says
how to convert an amount written against the other unit.

## Not gaps

- Currencies ISO adds after the pinned list: added by editing one constant; an unknown code is
  refused when the config loads (named), never guessed.
