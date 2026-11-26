# Research: theme-notion-date-time-picker

## Findings
- theme-notion has no date component; `src/ui/input.tsx` (classes of the field look: `h-7 rounded-md border
  border-input bg-field px-2.5 md:text-sm`, focus ring, `aria-invalid`) and `src/ui/popover.tsx` (Radix Popover,
  portal, `onOpenAutoFocus` to place focus) are the parts to compose. Radix returns focus to the trigger on close.
- theme-notion does not depend on `@softure-ai/core`. `LocalDateTime` is a branded string (`YYYY-MM-DDTHH:mm`,
  `foundation/core/src/local-date-time.ts`); a branded string is assignable to `string`, so the component can take and
  give plain strings in that format without a new dependency, and the app narrows with `isLocalDateTime`.
- Intl formats a wall-clock value without the browser's zone shifting it when the date is built with `Date.UTC` and
  formatted with `timeZone: "UTC"`; with a fixed default locale the trigger's text is the same on server and client.
- WAI-ARIA APG date picker dialog: a `grid` labelled by the month caption, a roving `tabindex`, arrows by day and week,
  Page Up/Down by month (Shift by year), Home/End to the week's start and end, Enter/Space to choose, Escape to close,
  `aria-selected` on the chosen cell, `aria-current="date"` on today, focus on the chosen (or today's) day on open.
- Touch size: `size-touch-target` / `h-touch-target` (44 px, `src/tokens.ts`), used below `md` by `Button` and
  `HelpTooltip`. 7 days of 44 px fit a 390 px phone inside the popover's padding.
- Registration a new composition needs (as for `HelpTooltip`): `src/index.ts`, README (name sentence, "Copy" list, a
  section), `tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`),
  `tests/behaviour/messages.test.tsx` (every message path), visual `gallery.png` baselines.
- A parallel thread (#1508) changes `ListEntry` / `FoldRow`; both add a CHANGELOG `Unreleased` entry, so a merge may
  conflict there only.

## Risks
- happy-dom has no layout; tests drive the grid through key events and read `aria-*` and focus.
- "Today" depends on the clock and the zone; tests fake only `Date`, so Radix's timers keep running.
