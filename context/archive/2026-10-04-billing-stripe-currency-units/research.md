# Research: billing-stripe-currency-units

Question: in which unit does Stripe expect `unit_amount` for each currency, where does billing's
unit (`Intl`'s minor unit) differ from it, and what must the adapter do about it?

## Sources

- Stripe, "Supported currencies" (`https://docs.stripe.com/currencies`), read 2026-10-04 through the
  documentation index (a direct fetch from this session is blocked by the egress proxy). Quoted:
  - "All API requests expect `amount` values in the currency's minor unit [...] `1000` to charge 10
    USD (or any other two-decimal currency). `10` to charge 10 JPY (or any other zero-decimal
    currency)." Currencies are two-decimal unless listed otherwise.
  - Special cases, **ISK**: "transitioned to a zero-decimal currency, but backward compatibility
    requires you to represent it as a two-decimal value, where the decimal amount is always `00`.
    For example, to charge 5 ISK, provide an `amount` value of `500`. You can't charge fractions of
    ISK." **UGX**: the same wording.
  - Special cases, **HUF** and **TWD**: "Stripe treats HUF as a zero-decimal currency for
    **payouts**, even though you can charge two-decimal amounts. When you create a manual payout in
    HUF, you must provide integer amounts that are evenly divisible by 100." (TWD: the same.)
- The zero-decimal list on that page is rendered by a component the text export leaves out. The
  documentation index matches the page for the codes BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG,
  RWF, UGX, VND, VUV, XAF, XOF, XPF; that is Stripe's long-standing zero-decimal list (UGX being the
  special case above). **Assumption A1:** this is the full list.
- Three-decimal currencies are not in the current text export either. **Assumption A2** (from
  Stripe's earlier guide): BHD, JOD, KWD, OMR and TND are sent with three decimals, and the last
  digit must be `0` (amounts in multiples of 10 minor units) for compatibility with card networks.
- Runtime (Node 22, the CI version): `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`
  per currency. Digits other than 2:
  - 0: AFN ALL BIF CLP DJF GNF IQD IRR ISK JPY KMF KPW KRW LAK LBP MGA MMK PYG RSD RWF SLL SOS SYP UGX VND VUV XAF XOF XPF YER
  - 3: BHD JOD KWD LYD OMR TND

## Findings

1. **HUF and TWD need nothing for a charge.** The divisible-by-100 rule is for payouts. `Intl` gives
   both 2 digits, as Stripe charges them. The roadmap's reading (W1) mixed the payout rule in.
2. **The real gap is wider than ISK and UGX.** Every currency `Intl` formats with 0 digits but Stripe
   treats as two-decimal is charged 100 times too little: ISK and UGX (Stripe's special cases), and
   also AFN, ALL, IQD, IRR, KPW, LAK, LBP, MMK, RSD, SLL, SOS, SYP and YER (CLDR drops their unused
   minor unit; Stripe keeps two decimals). An ALL 1,500 plan would be charged ALL 15.
3. **Zero-decimal and three-decimal currencies agree.** Stripe's zero-decimal list (A1) all have 0
   digits in `Intl`; BHD, JOD, KWD, OMR, TND have 3 in both. LYD has 3 in `Intl` and is not a Stripe
   three-decimal currency (Stripe would read it as two-decimal).
4. **The webhook reads Stripe's unit back.** `readCheckout` records `amount_total` and `readRefund`
   passes `amount_refunded` unchanged, so an ISK payment would be stored (and shown in the account
   history, `src/next/pages.tsx:191`) at 100 times its price. The two sides must convert together.
   A charge carries `currency` (Stripe sends it on every charge object); the fixtures omit it today.

## Options

| Option | For | Against |
| --- | --- | --- |
| A. Scale in the adapter: Stripe digits from two lists (zero, three), two-decimal otherwise; `unit_amount = amount × 10^(stripe − intl)` | config stays in `Intl`'s unit everywhere (tiles, history, manual); fixes all 15 currencies at once | the two lists are Stripe's and can change; a currency Stripe moves between them is charged wrongly until the list follows |
| B. Refuse ISK/UGX/... at config load | no conversion code | a valid currency becomes unusable for no product reason |
| C. Make the plan's amount Stripe's unit | none | breaks formatting and the manual adapter; the unit would depend on the provider |

**Chosen: A**, plus a refusal at config load for what cannot be scaled exactly: an amount whose
conversion is not a whole number (`Intl` digits above Stripe's, e.g. LYD 1.234) or a three-decimal
amount whose last digit is not 0 (A2). The provider contract gets an optional check so the config
names the plan, as the other option errors do.

## Not gaps

- Stripe's minimum charge depends on the account's settlement currency, so it cannot be checked
  from the config; Stripe refuses the Checkout and the buyer sees `billing.payment_failed`, which the
  log explains. Same for Stripe's maximum digits per payment method and currencies Stripe does not
  support at all.

## Risks

- `Intl`'s digits depend on the runtime's CLDR: the CI runner's Node 22 gives HUF 0 digits, the
  local Node 22.22 gives 2 (found by this change's CI). The conversion follows `Intl`'s unit, so it is
  right on both; the plan amount's meaning changing with the runtime is older than this change and
  filed as FU-32.

- A1/A2 rest on Stripe's earlier guide where the current export is silent. Both lists are constants
  in one file with the source named, so a change is a one-line edit; the sandbox e2e (LT-1) charges a
  real amount.
