---
change_id: ci-playwright-chromium-cache-820
title: "ci: Chromium install survives a slow apt mirror (issue #820)"
status: in_progress
roadmap_item: null
issue: 820
branch: claude/project-thread-8k5vj4
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #820](https://github.com/SOFTURE/AI/issues/820): the `theme-notion visual regression and axe` job in
`themes.yml` fails in "Install Chromium" whenever the runner's Ubuntu mirror is slow, because
`npx playwright install --with-deps chromium` must finish apt and the browser download within 5 minutes. After the
change the browser comes from a cache keyed on the Playwright version, and a slow mirror delays the job instead of
failing it. `e2e.yml` installs Chromium the same way and gets the same treatment.

## Context

- Labels: `bug`, `pkg: theme-notion`.
- Seen on 2026-10-26 on PR #812: three timeouts in a row, every other check green.

## Constraints

- The browser build stays the one Playwright pins for its installed version (the baselines were taken with it).
- The axe and visual checks are not skipped or loosened.
- No release: CI only.

## Notes

- Framing: skipped. The issue names the cause and the fix.
