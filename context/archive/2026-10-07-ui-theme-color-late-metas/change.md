---
change_id: ui-theme-color-late-metas
title: "ui: ThemeScript recolours theme-color metas inserted after DOMContentLoaded (issue #201)"
status: archived
roadmap_item: null
issue: 201
branch: claude/project-thread-e2sziw
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Fix issue [#201](https://github.com/SOFTURE/AI/issues/201): with an explicit theme choice, every
`meta[name="theme-color"]` must carry the chosen bar colour after the first load, including metas that Next inserts
after the document is parsed (streamed metadata on dynamic routes, React hoisting during hydration).

A reviewer checks `foundation/ui/src/theme/theme-cookie.ts` (`getThemeBootScript`), the new DOM test
`foundation/ui/tests/theme-boot-dom.test.ts`, the README line and the version bump.

## Context

- The boot script sets `data-theme` from the cookie and, on `DOMContentLoaded`, rewrites the metas present at that
  moment. An adopting app saw three metas on a dynamic route: `['#f6f7f8', '#f6f7f8', '#0c0c0d']`; the third,
  inserted later, kept the dark colour on a light page.
- `applyThemeChoice` (the switch) queries at click time, so only the first load is affected.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo ("an adopting app").
- The script stays self-contained, synchronous, wrapped in `try`, and free of raw `<`, `>`, `/` in string literals.
- Only `@softure-ai/ui` changes. No other open change touches ui; the change bumps ui 0.1.9 → 0.1.10 and the thread releases it after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names the function and the cause; the reading needed
  (`theme-cookie.ts`, `theme-script.tsx`, `tests/theme-cookie.test.ts`) is summarised in `plan.md` § Findings.
- Framing: skipped. The observed effect, the cause and the expected state are measured in the issue; the only
  open choice (observer lifetime) is a plan decision.
