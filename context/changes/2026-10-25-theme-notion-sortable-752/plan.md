---
change_id: theme-notion-sortable-752
---

# Plan: theme-notion sortable list (issue #752)

Input: change.md, research.md. Complexity: medium (one client composition, a new runtime dependency, copy, docs).

## Phase 1: SortableList, SortableItem, SortableHandle

Files: `themes/theme-notion/package.json`, `package-lock.json`, `themes/theme-notion/src/notion/Sortable.tsx`,
`themes/theme-notion/src/messages/en.ts`, `themes/theme-notion/src/index.ts`,
`themes/theme-notion/tests/notion/Sortable.test.tsx`.

1. Dependencies `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2.
2. `SortableList` (`"use client"`): a `<ul>` with `label`, `items` (ids in order), `onReorder(next, { id, from, to })`,
   `dragBy` (`row` default, `handle`), `holdDelay` (500), `tolerance` (8), `instructions`, `announcements`,
   `getItemLabel(id)` (defaults to the id). Sensors: mouse and touch with `{ delay, tolerance }` (mouse in `handle`
   mode starts after 4 px instead, a desktop handle needs no hold), keyboard with `sortableKeyboardCoordinates`.
   Vertical-only modifier, `verticalListSortingStrategy`, `DndContext id` from `useId()`.
3. Announcements as strings with `{item}`, `{position}`, `{total}` placeholders, filled in by the part; defaults in
   `en.sortable`.
4. `SortableItem`: an `<li>` (`data-slot="sortable-item"`, `data-id`, `data-dragging` while lifted) with
   `touch-manipulation select-none [-webkit-touch-callout:none]`, rounded, and the lifted look
   `data-[dragging]:bg-accent-strong data-[dragging]:shadow-menu data-[dragging]:relative data-[dragging]:z-10`.
   In `row` mode the row carries the drag attributes and listeners (role stays `listitem`); in `handle` mode they
   go to `SortableHandle` through context.
5. `SortableHandle`: a ghost `icon-sm` button with `GripVertical`, `label` defaulting to `en.sortable.handle`,
   `cursor-grab`, `touch-none`.
6. Export the three parts and their prop types, plus `SortableAnnouncements` and `SortableMove`.
7. Tests (happy-dom): list and slots render with `data-*`; row mode makes the row focusable with the instructions as
   its description; handle mode moves them to the handle; keyboard pick, arrow, drop calls `onReorder` with the
   moved order; Escape cancels without a call; announcements use the app's strings; default copy is English.

## Phase 2: docs

Files: `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. README: the part in "Components" with an example and the touch behaviour; the new props in "Copy".
2. CHANGELOG "Unreleased": the part, and the migration for an app that wired dnd-kit itself.

## Decisions (auto)

- New runtime dependency `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities` for `CSS`): the library the
  adopting app already uses, headless, accessible (keyboard sensor, live region), MIT, with the touch hold the issue
  asks for. Writing pointer, touch and keyboard sorting by hand would be far more code to get right.
- Controlled order (`items` + `onReorder`): the app keeps its state and persistence; the part only reorders ids.
- Copy as placeholder strings rather than functions, so they come straight from the app's message dictionary.
- No move up / move down buttons: the keyboard sensor is the non-drag alternative; an app may still add its own.
- No version bump; the coordinator releases.

## Progress

- [x] Phase 1: SortableList, SortableItem, SortableHandle (d482450)
- [x] Phase 2: docs (4a0f7c1)
