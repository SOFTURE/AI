---
change_id: ui-locale-provider-reach-435
status: archived
---

# Plan: client components outside ui follow UiLocaleProvider (issue #435)

Input: change.md, research.md. Complexity: small.

## Phase 1: charts reads the provider (TDD)

Files: `foundation/charts/src/cursor/chart-cursor.tsx`, `foundation/charts/src/cursor/event-axis.tsx`,
`foundation/charts/package.json` (ui peer `^0.1.7 || ^0.2.0`); tests in `foundation/charts/tests/cursor.test.tsx` and
`foundation/charts/tests/event-axis.test.tsx`.

1. Tests first: under `<UiLocaleProvider locale="pl">` without a prop, the accessible name comes from
   `chartsMessages.pl`; an explicit `locale="en"` wins over the provider.
2. Implement: `getChartsCopy({ locale: useUiLocale(locale), messages })` in both components.

## Phase 2: docs

- charts, billing, privacy, feature-switches README: one line each where `locale` is documented: client components
  follow `UiLocaleProvider` (prop, then provider, then `en`); server components take the prop.
- CHANGELOG `## Unreleased` in charts (behaviour and peer range) and the three module packages (docs only).

## Phase 3: own translation through the provider (TDD, re-scope)

Files: `foundation/ui/src/ui/locale.tsx` (context value `{ locale, messages }`, `useUiCopyProps`),
`foundation/ui/src/ui/copy.ts` (`mergeCopyOverrides`), every client call of `getCopy`, `external-link.tsx`,
`softure-theme-provider.tsx`; test `foundation/ui/tests/locale-messages-435.test.tsx`; ui README and CHANGELOG.

1. Tests first: provider messages replace a client component's copy with English as the base; a component's own
   messages win key by key; the server-safe Card hint and ExternalLink note follow; SoftureThemeProvider passes them;
   no messages leaves the copy unchanged.
2. Implement: client components call `getCopy(group, useUiCopyProps(group, { locale, messages }))`.

## Progress

- [x] Phase 1: charts reads the provider (`a1249fd`; 4 tests in `locale-provider.test.tsx`, written first and red before the fix)
- [x] Phase 2: docs (`3547673`; README lines in charts, billing, privacy, feature-switches; CHANGELOG `## Unreleased` in all four)
- [x] Phase 3: own translation through the provider (`aef046e`; 5 tests in `locale-messages-435.test.tsx`, 4 red
  before the change; ui suite 43 files green)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; charts tests (15 files, 233 tests)
and repository tests (13 files, 510 tests) pass; the full `npm test` runs in pre-push.
