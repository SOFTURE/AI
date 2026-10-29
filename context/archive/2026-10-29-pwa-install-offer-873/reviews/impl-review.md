---
change_id: pwa-install-offer-873
verdict: approved
---

# Implementation review

Reviewed the diff from e1852f4 against plan.md and issue #873.

- Acceptance of #873, item by item: the kept prompt store, created when `@softure-ai/pwa/react` loads in a browser
  (`installPromptStore`), with `preventDefault()`, forgotten on `appinstalled`, `subscribe`/`getSnapshot` and a `null`
  server snapshot; `openInstallPrompt()` uses the event once (spent before `prompt()` resolves, so a double tap cannot
  reuse it) and answers whether the sheet opened, `false` on a refusal; `pickInstallOffer` as a pure function, a
  desktop and the installed app never offered; `isIosDevice` (iPad with a Mac user agent through touch points > 1),
  `isPhoneDevice` (`userAgentData.mobile`, else `Mobi|Android`), `isInstalledApp` (standalone display mode or iOS
  `navigator.standalone`); the closed flag under `<app>:pwa-install-closed`, a blocked storage read as not closed and a
  refused write closing the offer for the open page only; `useInstallOffer({ app })`; theme-notion `InstallBar` with
  the prompt button or the iOS steps, a labelled close button, copy as props keyed like `pwaMessages.en.install`,
  touch-target sizes and the safe-area insets.
- Hydration: the hook reads device facts and the flag after mount; the server render and the first client render
  show no offer (pinned by a `renderToString` test).
- Tests assert the blocked-storage cases against the real `localStorage` getter, not a vacuous empty storage.
- theme-notion: two isolated gallery cases (their own visual pages), so the full-page baselines do not move; all 116
  visual tests and axe pass; parity fixture regenerated; inventory, README list and CHANGELOG agree.
- Gates: typecheck, ESLint and the language gate in pre-commit; `vitest` over `modules/pwa`, `themes/theme-notion`
  and `tests/repo` green except `deploy-workflows`, which fails the same way on master in this container (no
  `ssh-keygen`), not this change.

Verdict: approved, no changes.
