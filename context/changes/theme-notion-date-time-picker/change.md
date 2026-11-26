---
change_id: theme-notion-date-time-picker
title: "theme-notion: DatePicker and DateTimePicker with the theme's calendar and time field (issue #1509)"
status: in_progress
roadmap_item: null
issue: 1509
branch: claude/project-thread-6hz0ds
created: 2026-11-26
updated: 2026-11-26
---

## Intent
theme-notion ships `DatePicker` and `DateTimePicker`: a trigger that looks like the theme's `Input` and shows the
chosen value in the app's locale, a `Popover` with a keyboard-driven month calendar (WAI-ARIA date picker pattern) and,
for `DateTimePicker`, an hours and minutes field with an optional minute step; `min` / `max`, the app's time zone as a
muted suffix, the value in and out as `YYYY-MM-DD` / core's `LocalDateTime` (`YYYY-MM-DDTHH:mm`), a hidden input under
`name` for a server action form, 44 px touch targets on a phone. Issue #1509 (`enhancement`, `pkg: theme-notion`).

## Context
theme-notion 0.38.0 has `Input`, `Popover`, `Field` and `Dialog` but no date picker; an app that schedules something
falls back to the browser's native date and time inputs, which ignore the theme's tokens and dark mode and cannot show
the app's time zone.

## Scope
- New composition `src/notion/DatePicker.tsx` (`DatePicker`, `DateTimePicker`), exported from the package root, its
  English copy in `messages/en.ts` (`datePicker.*`) replaceable through a `messages` prop.
- Unit tests (red first), the gallery case, the class fixture, the visual baselines, README, CHANGELOG `Unreleased`,
  the "NOTION · Design System" artifact.
- Out of scope: a date range picker; converting to an instant (the app calls core's `getLocalDateTimeInstant`); the
  adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: the issue names the gap and the proposed component.
