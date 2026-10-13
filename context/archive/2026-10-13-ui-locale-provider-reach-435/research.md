---
change_id: ui-locale-provider-reach-435
---

# Research: ui-locale-provider-reach-435

Sources: `foundation/ui/src/ui/locale.tsx`, every `"use client"` file outside `foundation/ui` that mentions `locale`,
`foundation/charts/src/messages/index.ts`, published `@softure-ai/ui` tarballs 0.1.6 to 0.1.14, a render probe of
`DeleteAccountForm` with and without the provider.

- `useUiLocale(explicit)` returns `explicit ?? provided ?? "en"`; `@softure-ai/ui` exports it from 0.1.7 on (0.1.6's
  `dist` has no `useUiLocale`).
- Client components outside ui that take `locale` (7 packages): charts `ChartCursor`, `EventAxis`; billing
  `PaymentForm`, `TrialForm`, `GrantForm`, `AccountLookup` (grant-history), `PaymentRequests` (no `locale` at all);
  privacy `DeleteAccountForm`; feature-switches `SwitchPanel`; also auth forms, waitlist `WaitlistForm`, mcp-access
  `TokenManager`.
- charts: both components call `getChartsCopy({ locale, messages })`, which defaults to `en`. This is the real gap:
  under a `pl` provider the cursor's and event axis' accessible names and readouts stay English.
- Every module component uses `locale` only to forward it to ui components (`TextField`, `PasswordField`,
  `SelectField`, `Switch`, `Field`). Each of those calls `useUiLocale(locale)` itself, so with the prop `undefined` the
  provider already applies. The probe rendered identical markup with and without the provider: none of these forms
  shows provider-driven copy in its idle state (no field hints), so nothing renders in the wrong language. The module
  copy itself comes from the required `messages` prop, already in the app's language.
- Module text formatting (`formatMessage`) in feature-switches and billing client components uses `messages`, not
  `locale`. Locale-dependent formatting (`formatPrice`, `formatLastDay`) lives in the server components
  (`PricingTiles`, `AccessBadge`, `AccessNotice`), which take a required `locale` and cannot read context.
- charts peer range on ui is `^0.1.6 || ^0.2.0`; importing `useUiLocale` needs `^0.1.7`. Dev dependency is already
  `^0.1.7 || ^0.2.0`. The repo test `tests/repo/packages.test.ts` only checks that a ui peer is also a dev dependency.
