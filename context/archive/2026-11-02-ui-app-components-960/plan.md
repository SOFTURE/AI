---
change_id: ui-app-components-960
status: archived
---

# Plan: app components in ui, Flat Paint look maps (issue #960)

Input: change.md, research.md (option 1). Complexity: medium (two packages and docs).

## Phase 1: ui components (TDD)

Files: `foundation/ui/src/ui/{progress-bar,launch-screen,app-prompts,icons,index}.tsx|ts`,
`foundation/ui/scripts/build-css.mjs`, `foundation/ui/tests/app-components-960.test.tsx`.

- `ProgressBar` (`root`, `indicator`): `role="progressbar"`, `aria-label`, min 0, max 100, `aria-valuenow` when a
  value is given; `data-slot="progress"` / `progress-indicator`; `data-state` `indeterminate` / `loading` /
  `complete`; the indicator moves by `translateX`. Without a value a third of the track slides (`sft-indeterminate`
  keyframes); with reduced motion it stands still, full and faint.
- `MiniProgress` (`root`, `indicator`, `label`): theme-notion's API (`value` clamped 0–100, `label`, `tone`
  `success | warning | danger`), the label drawn twice, the second copy clipped to the fill.
- `LaunchScreen` (`root`, `icon`, `name`, `bar`, `indicator`, `percent`), `TopLoadingBar` (`root`, `bar`,
  `indicator`), `RouteLoading` (`classNames` per screen): theme-notion's props and slots, the display picked by CSS.
- `InstallBar` and `UpdatePrompt` (`root`, `panel`, `icon`, `title`, `description`, `action`, plus `steps`, `step`,
  `close` for the install bar): a polite status inside the safe-area insets, the action at least 44 px on a phone,
  the close button a 44 px `IconButton`. New icons `ShareIcon`, `SquarePlusIcon`.
- Tests: ARIA and values, the clamp, the slots, `unstyled`, `classNames`, and the pwa counter driving
  `LaunchScreen` and `TopLoadingBar` (its function run on the rendered markup in happy-dom).

## Phase 2: Flat Paint look maps

Files: `themes/theme-flat-paint/src/look/app.ts`, `src/index.ts`, `src/page.css` (`prompt-enter`),
`tests/app-look.test.tsx`, `tests/theme-css.test.ts`.

- `INSTALL_BAR_LOOK`, `UPDATE_PROMPT_LOOK`: flat panel on `surface-raised` with the hairline, rises in
  (`prompt-enter`: `flat-paint-rise-in`, `--duration-base`, `--ease-out-soft`), title `text-subsection`, description
  `text-body-sm` `muted`, the primary action without a border.
- `LAUNCH_SCREEN_LOOK`, `TOP_LOADING_BAR_LOOK`, `ROUTE_LOADING_LOOK`: the thin bars paint with `accent` (never lime
  as a thin line), the name on `text-band`, the percent as `num` `muted`.
- `MINI_PROGRESS_LOOK`: `rounded-flag`, track on `foreground` at 8 %, label `text-caption` `num`.
- Tests: the maps render through the ui components; their classes compile in an app's Tailwind.

## Phase 3: docs

ui README (Primitives table, a section for the app components), ui and theme-flat-paint `CHANGELOG.md`
`## Unreleased`, theme-flat-paint README (look-map table, "ships no components" stays true), pwa README (the Flat
Paint import next to the Notion one).

## Decisions (auto)

- The components live in ui (research option 1); theme-notion untouched.
- Names follow theme-notion (`InstallBar`, …, `MiniProgress`); the plain bar is `ProgressBar`, since ui names things
  by what they are and a `Progress` export would read as a type.
- The touch height comes from `min-h-11` below `md`, so it never fights the button's own `h-*` in one layer.
- No version bump: the coordinator releases the batch.
- `TOP_LOADING_BAR_LOOK` dropped during implementation: ui's top bar already paints with `accent` on no track, so a
  map would hold nothing that differs; `ROUTE_LOADING_LOOK` carries the launch screen's map only.

## Progress

- [x] Phase 1: ui components (e7b9100)
- [x] Phase 2: Flat Paint look maps (77e2ede)
- [x] Phase 3: docs (abaa205)
- [x] Implementation review
