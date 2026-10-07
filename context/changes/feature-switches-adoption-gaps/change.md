---
change_id: feature-switches-adoption-gaps
title: "feature-switches fits an app shell, refreshes its panel, and documents adopting an existing table"
status: plan_reviewed
roadmap_item: null
issue: "#202"
branch: claude/project-thread-obav7c
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close [issue #202](https://github.com/SOFTURE/AI/issues/202): five gaps an adopting app hit when it moved its own
switches table and admin screen onto `@softure-ai/feature-switches` 0.1.6. After this change:

1. An app that builds its own panel page inside its shell gets the row mapping from the package
   (`toSwitchPanelRows`, `describeSwitchSource` from `/next`) instead of copying `describeSource`.
2. `exportSwitchesUserData` and `deleteSwitchesUserData` take `{ db }` only, and the deletion reports how many
   switches it cleared.
3. The README has a section "Adopting an existing switches table" with the checklist that makes
   `baseline: { "feature-switches": 1 }` pass, and a test proves it.
4. The README shows the break-glass SQL upsert (`updated_at = now()`, `updated_by = null`).
5. `setSwitchAction` revalidates the panel route after a stored change, so the row's source note is fresh.

The issue's closing note (Vitest `server.deps.inline` for `/next` tests) is documented in the README too.

## Context

- `describeSource` is private in `modules/feature-switches/src/next/pages.tsx`; `SwitchesPage` renders its own
  `<main>` and `Card` title.
- The privacy helpers (`src/server/privacy.ts`) type their context as `ModuleContext` and read only `db`;
  `PrivacyContributor.deleteUserData` in core must return `Result<undefined>`.
- `setSwitchAction` (`src/next/actions.ts`) never calls `revalidatePath`; billing and mcp-access do, with the
  module's route from `getModule(config).routes`.
- The panel route is overridable (`featureSwitches({ routes: { panel } })`), so an app with its own panel path
  names it there and the revalidation follows.

## Constraints

- Only `modules/feature-switches/` (source, tests, README, CHANGELOG, version) and this change folder.
- Nothing breaks for an app that mounts `SwitchesPage` as it does today.
- `deleteSwitchesUserData` changes its return value (0.x minor-level change, recorded in the CHANGELOG); the
  privacy contributor keeps returning `ok()` as core requires.

## Notes

- Placement: unlinked (`roadmap_item: null`), an adoption issue; the project works from issues, not a roadmap.
- Research skipped: the issue names every code path (`pages.tsx`, `actions.ts`, `privacy.ts`, the migration file),
  each was read while opening the change, and the precedents (billing and mcp-access revalidation, db baseline
  tests) are in the repository.
- Framing skipped: the issue states the observed failures with measured workarounds and concrete suggestions;
  no competing cause is in question.
