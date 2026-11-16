# Implementation review: theme-notion-side-panel-footer-1312

Verdict: approved, no findings left open.

- Matches the plan: one optional prop, the strip after the content inside the `aside`, markup unchanged without it.
- Tests: no strip without `footer`; strip is the panel's last child and outside `side-panel-content`, exact classes,
  holds the footer; hidden while closed. `npx vitest run themes/theme-notion`: 61 files, 1229 tests passed;
  `npm run typecheck` and ESLint on the touched files clean.
- Version: `themes/theme-notion` 0.21.0, CHANGELOG `## 0.21.0`; the local tag was dropped, `auto-release` tags it.
- Rebased on master after #1315 shipped 0.20.0 (ResizeHandle, `SidePanel width`): both props kept, version moved to 0.21.0.
