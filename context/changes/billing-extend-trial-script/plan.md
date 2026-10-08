# Plan: billing-extend-trial-script

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases).

## Today (master `c323892`)

- `extendTrialManually(ctx, { userId, until, adminId })` (`/server`) moves the trial end to `until` in one
  transaction (account key share → pin → `lockEntitlementRow` → own row), refuses `billing.end_not_in_future`,
  `billing.trial_not_extended`, `billing.account_unknown`, and records `billing.trial_extensions`; `adminId: null` is
  documented for a script, but no script exists.
- `@softure-ai/billing/scripts` has `grant-plan`, `revoke-grant`, `import-entitlements`, `pin-trials`, all on
  `defineOpsScript` (`@softure-ai/ops/scripts`): `--key=value` strings validated by a zod strict object, a dry run is
  the same transaction rolled back, the report is `{ before, after }`.
- The admin form's last day `D` becomes `until = getStartOfDay(D + 1, timezone)` (`extendTrialAction`).
- `PaymentPage` / `BillingAdminPage` render `PageHeading` (`heading?: string | null`) as the first child of `<main>`;
  nothing can follow it before the first card.

## Goal

`@softure-ai/billing` 0.1.9 with both points of #243.

**Out of scope:** an `npx softure-billing` binary (the package ships script factories the app bundles, like the
other four; the issue's CLI line is met by the app's one-file runner shown in the README), shortening a trial,
extending many accounts in one run.

## Key decisions

- **Arguments:** `--email=<account email>` or `--user=<account id>` (exactly one; an id that is not a UUID or has no
  account is "no account …"); `--until=YYYY-MM-DD` or `--days=N` (exactly one). Both checked by the zod schema, so
  a missing or doubled one is a usage error before the database opens.
- **`--until=D`** is the trial's new **last day**, as in the admin form: the end is the start of `D + 1` in the app's
  time zone. A malformed day is a usage error.
- **`--days=N`**: a whole number 1…36500 (a hundred years is the longest an operator types; larger is a typo). The
  base day is the later of today and the current trial end's day (both in the app's time zone); the end is the start
  of `base + N`. So a trial ending when 20 October begins, extended by 10 on 8 October, ends when 30 October begins;
  an ended trial extended by 10 on 8 October ends when 18 October begins (today counts as the first day, as in a new
  trial). The current end comes from `findEntitlementRecord` (stored or derived).
- **Refusals** map `extendTrialManually`'s codes to operator lines: no account, the new end is not in the future, the
  trial already lasts at least that long (with the current last day). Nothing is written on a refusal.
- **Report:** `before` / `after` = `{ userId, trialEndsAt, access }` (`access` = `getEntitlement`); `after` also has
  `extensionId`. No email.
- **Paid or lifetime accounts:** extended like in the admin form (paid access still wins; the report shows it).
- **`lead?: string | null`** on both pages: one `<p>` right after the `<h1>` (or first in `<main>` when the heading is
  `null`), the muted lead style the cards use. Default none; no message is added, so the copy stays the app's.

## Phases

### Phase 1: extend-trial script (TDD)

- `src/scripts/trial-scripts.ts` (`createExtendTrialScript`, `ExtendTrialScriptArgs`, `TrialScriptOptions`,
  `MAX_EXTEND_DAYS`), exported from `src/scripts/index.ts`.
- Tests `tests/trial-scripts.test.ts`: dry run writes nothing and reports before/after; `--commit` moves the trial and
  records a `trial_extensions` row with `extended_by` null, listed in the history; `--days` counts from a future trial
  end and from today for an ended trial; `--until` is a last day; by `--user`; refusals (unknown email, unknown or
  malformed id, an end not later than the current one, an end in the past) write nothing; usage errors (both or
  neither of email/user, of until/days, `--days=0`, `--days=1.5`, a malformed day); the printed output has no email.
- Done when: billing tests green.

### Phase 2: lead prop, docs, version

- `src/next/pages.tsx`: `lead` on both props and `PageHeading` → heading + lead.
- Test in `tests/pages.test.tsx`: the lead follows the `<h1>` on both pages, is first in `<main>` with `heading={null}`,
  and is absent by default.
- README ("Scripts", "Page headings", package summary), CHANGELOG `0.1.9`, `package.json` version and description.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: extend-trial script
- [ ] Phase 2: lead prop, docs, version
