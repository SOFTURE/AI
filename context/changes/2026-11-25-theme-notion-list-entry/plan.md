# Plan: theme-notion-list-entry

## Approach
Two new server components in `src/notion/`: `ListEntry` (in `List.tsx`, next to `ListRow`) and `ResultBadge` (its own
file, on the tones). `ListEntry` is a flex-wrap row: the identity (`flex-1`, title and details) and a right side that
holds the column (status over actions) and, with `href`, the arrow beside it in one non-wrapping group. Below `md`
the identity takes the full width, so the side wraps under it, right-aligned. A control with `data-row-wide` makes the
side take the full width and its lines start on the left (`has-[[data-row-wide]]`).

## Phases
### Phase 1: ListEntry and ResultBadge (TDD)
- Tests first (red): `tests/notion/ResultBadge.test.tsx` pins the tone → colour map (`data-color`, the tag classes),
  the default icon per tone, an icon override, the word, `isSpinning` (`motion-safe:animate-spin`, muted by default
  stays muted); `tests/notion/List.test.tsx` adds `ListEntry`: slots rendered only when given, title as a stretched
  link with `href` (and a `linkComponent`), the arrow inside the side group, the side above the link, phone and
  wide-control classes. A Chromium measurement in `visual/fit.spec.ts`: two-line identity, a result badge and two
  controls: the badge's right edge at the row's right edge, above the controls; at 390 px the side starts below the
  identity, right-aligned, controls at least 44 px, the arrow on the same line as the column; a `data-row-wide`
  control spans the row width from the left.
- `src/notion/List.tsx`: `ListEntry`, `ListEntryProps`; `src/notion/ResultBadge.tsx`: `ResultBadge`,
  `ResultBadgeProps`, `RESULT_BADGE_ICONS`; exports in `src/index.ts`.
- Gallery cases `ListEntry` and `ResultBadge`, the parity fixture regenerated, visual baselines updated and looked at,
  README, CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass, the visual spec passes.

### Phase 2: Design System artifact
- Append `ListEntry` and `ResultBadge` to the "NOTION · Design System" artifact (its bundle and a preview), publish.

## Decisions (auto)
- A new `ListEntry` instead of slots on `ListRow`: `ListRow asChild` renders an app's button or link as the row, which
  cannot hold a stretched link and a column of controls; keeping it unchanged breaks no app.
- `details` is one node (the app writes its lines); `title` is a node.
- `href` with `linkComponent` (default `a`); the arrow (`ChevronRight`, muted, `aria-hidden`) shows only with `href`.
- The side is `relative z-10`, so clicks in it never reach the link; the arrow is part of the side group, so it never
  wraps alone.
- The wide control is `data-row-wide` on the app's control (the app's own marker), read with `:has()`; no extra prop.
- `ResultBadge` icons: success `CircleCheck`, danger `CircleX`, warning `TriangleAlert`, muted `CircleMinus`, default
  `Circle`; `isSpinning` defaults the icon to `LoaderCircle`. The colour is `TONE_COLORS[tone]` on a filled tag
  (`default` → the default tag).
- Released as a minor (new exports, nothing breaks dependent ranges) by whichever theme-notion thread merges last.

## Progress
- [ ] Phase 1: ListEntry and ResultBadge
- [ ] Phase 2: Design System artifact
