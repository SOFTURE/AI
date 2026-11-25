---
change_id: theme-notion-tab-bar-current-in-view
title: "theme-notion: TabBar scrolls the current tab into view and shows an overflow cue (issue #1477)"
status: archived
roadmap_item: null
issue: 1477
branch: claude/project-thread-m8hqbp
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
On a phone, a `TabBar` with more tabs than fit opens with the current tab visible, and a fade at the scrolling edge(s)
tells the user there are more tabs. Issue #1477 (`bug`, `pkg: theme-notion`).

## Context
`TabBar` is a server-renderable `<nav class="overflow-x-auto">` of links. At 390 px with five tabs carrying counts, a
deep link to a late tab renders the strip scrolled to the start (the current tab off-screen), nothing hints that the
strip scrolls, and a tab cut at the edge reads like a rendering bug. `TabsList scrollable` (#908) already centres its
active trigger with a client effect; `TabBar` (#723) has no client code.

## Scope
- `TabBar` becomes a client component: on mount and whenever `current` changes it scrolls the strip only (its own
  `scrollLeft`, never the page) so the current tab is fully in view ("nearest": no move when it already is).
- Overflow cue: `data-overflow-start` / `data-overflow-end` on the nav while content is hidden on that side, updated on
  scroll and resize; each draws a 32 px mask fade on that edge. Static, so nothing moves under `prefers-reduced-motion`;
  the scroll is instant.
- Tests (red first), parity fixture, README, CHANGELOG `Unreleased`, the `NOTION · Design System` artifact.
- Out of scope: arrow buttons; the adopting app.

## Decisions (auto)
- Scroll by setting the nav's `scrollLeft` from bounding rects instead of `scrollIntoView`, so no ancestor (the page)
  ever scrolls, and the result does not depend on the offset parent.
- "Nearest" (the issue's wording) rather than centring as `TabsList` does: a link bar keeps its start when the current
  tab is already visible.
- Cue as a CSS mask (`mask-l-from` / `mask-r-from`, Tailwind v4) rather than overlay gradients: it needs no colour,
  so it works on any background and in both themes.
- Two boolean attributes rather than one enum, so an app can style either edge.
- Feature-level change (new behaviour, no API change): minor bump at release, recorded under `Unreleased`.

## Notes
- research skipped: the component is one file, the prior art (`useCentredActiveTrigger` in `src/ui/tabs.tsx`) and the
  expected behaviour are named in the issue.
- frame skipped: a reported, reproduced bug with the expected behaviour spelled out.

## Done
`TabBar` scrolls its own strip, never the page, so the current tab is whole on load and whenever `current` changes,
with a fade's width (32 px) of room; each edge that hides tabs fades out with a static mask and is marked
`data-overflow-start` / `data-overflow-end`. `TabBar` is a client component with unchanged props. Tests (red first),
parity fixture, README, CHANGELOG `Unreleased`; ships in the next theme-notion release.
