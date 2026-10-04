# Implementation review: billing-price-minor-units

Reviewed: the branch diff (`modules/billing/{src/currency-digits.ts,src/price.ts,src/stripe-currency.ts,src/stripe-webhook.ts,src/options.ts,src/index.ts,README.md,tests/}`)
against plan.md and the plan review. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| Phase 1, step 1: tests first | Done: pinned digits (HUF, TWD, ISK, UGX, JPY, MGA, KWD, IQD, ALL, RSD, XCG), HUF 29.50 / NT$29.50 / ALL 1,500.00 / IQD 25.000 / ISK 1,500, HRK, SLL, CLF, XAU, UYW refused and XCG accepted, table shape (S1), the runtime agreement test over every pinned currency in `en` and `pl`, the unknown-code throw next to an HRK row that still formats (W1), Stripe expectations as literals (W2). |
| Step 2: `currency-digits.ts` | Done: ISO 4217 List One 2024-06-25 by digits, funds, `N.A.` units and UYW left out, MGA → 0 and XCG → 2 commented with why; a frozen record. |
| Step 3: `price.ts` | Done: `getMinorUnitDigits` reads the table (own keys only, so `toString` is not a currency) and throws for an unknown code; the formatter fixes `minimumFractionDigits`/`maximumFractionDigits` to the table's digits; a code outside the table formats with `Intl`'s defaults; `isSupportedCurrency` reads the table. |
| Step 4: Stripe | Done: comments name the pinned unit; the "problem exactly when unconvertible" loop runs over the table; ALL and MGA go unchanged, ISK and UGX ×100, IQD refused unless it ends in 0. |
| Step 5: options | Done: the message says "billing knows"; the module test follows it. |
| Step 6: README | Done: a "Minor units" paragraph (source, the override and the addition, the runtime only supplies notation, the currencies whose amounts differ from current runtimes' `Intl` and how to convert), the Stripe section speaks of billing's unit. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | One table feeds validation, formatting and Stripe's shift, so the three cannot disagree. The formatter cache key (locale, currency) is enough: the digits depend on the currency alone. |
| Tests that bite | The old `Intl` path fails the pinned-digits test (ALL 0, and HUF 0 on the CI runner's ICU) and the agreement test (ALL 123,407 instead of 1,234.07); restoring `Intl.supportedValuesOf` fails the HRK/SLL/XCG test. |
| Money safety | Nothing is rounded: digits only change which power of ten divides for display and which shift goes to Stripe; Stripe's refusal of an inexact amount is unchanged. |
| Errors | An unknown code is refused when the config loads (named per plan); converting one later is a bug and throws with the operation and the code; display of a stored row never throws. |
| Compatibility | Signatures unchanged; `CURRENCY_MINOR_UNIT_DIGITS` added. Amounts in AFN, ALL, IRR, KPW, LAK, LBP, MMK, RSD, SOS, SYP, YER, IQD (and HUF/TWD on older runtimes) now mean what ISO says; `@softure-ai/billing` is unpublished (MO-6), and the README tells deployers how to convert. No stored row changes. |
| Docs | README "Minor units"; the Stripe section's examples follow the table. |
| Gates | `npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test` (all packages and repository tests), `npm run build`. |

## Findings

None open. A Stripe webhook naming a currency outside the table cannot happen for a payment billing
started (its plan's currency passed the config check), so the throw in `fromStripeAmount` marks a bug
rather than an input to handle.
