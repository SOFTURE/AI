---
change_id: pwa-launch-screen-911
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and master (a29959c).

- Worker (#911, third point): `keepPage` reads the page and keeps nothing whose HTML defines or calls `$RX` or carries a
  `<meta http-equiv="refresh">`; the page is still served and the earlier copy stays (three cases tested), and a page
  that only mentions "refresh" or "$RX" in its text is still kept.
- Counter: `launchProgress` is self-contained (the served-text test caught a module constant and it moved inside),
  paint, assets (Resource Timing) and time shares, capped at 99, never falling, stopping when replaced or at 99,
  no-op outside a launch screen. `buildLaunchProgressScript` checks the options and escapes `</`.
- Screen: `LaunchScreen` in theme-notion with the slots the counter moves (tested from the server-rendered HTML),
  icon decorative, bar named by `pwaMessages.en.launch.label`, percentage hidden and hydration-safe. Gallery case,
  parity fixture and four visual baselines (light and dark, desktop and phone); full visual suite 132 of 132.
- Docs: both READMEs (mounting, counter rules, worker rule, copy, limitations: no startup images, no counter on
  client-side navigations) and both `CHANGELOG.md` `## Unreleased`.
- Gates: typecheck, ESLint and the language gate, pwa and theme-notion tests green (a test that leaked a head script
  into the next one under random order was fixed to clean the head).

Verdict: approved.
