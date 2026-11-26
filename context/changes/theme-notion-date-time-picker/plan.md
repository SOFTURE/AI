# Plan: theme-notion-date-time-picker

## Approach
`src/notion/DatePicker.tsx`: one internal picker with a `withTime` switch behind `DatePicker` (`YYYY-MM-DD`) and
`DateTimePicker` (`YYYY-MM-DDTHH:mm`). Value controlled (`value` + `onValueChange`) or not (`defaultValue`); an invalid
value counts as empty. Trigger: a button with the `Input` look (`max-md:h-touch-target`), a calendar icon, the value
formatted by `Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle?: "short", timeZone: "UTC" })` or the
placeholder, the `timeZone` as a muted suffix; other button props pass through (`id`, `aria-*`). Popover (`open`,
`defaultOpen`, `onOpenChange`): header with previous and next month buttons and the month caption (`aria-live`), a
`grid` of the month (6 weeks, `weekStartsOn`, default Monday), day buttons with a roving `tabindex`, a full-date
`aria-label`, `aria-current="date"` for today in `timeZone`, disabled outside `min` / `max`
(`max-md:size-touch-target`). `DateTimePicker` adds hours and minutes `<select>`s (hour labels in the locale, minutes
by `minuteStep`, options outside `min` / `max` disabled) and a Done button. A hidden input carries `name`.

## Phases
### Phase 1: DatePicker and DateTimePicker (TDD)
- Tests first (red: the module does not exist) in `tests/notion/DatePicker.test.tsx`: trigger look, placeholder,
  formatted value and time zone, hidden input in a form; the grid of the value's month with focus on the chosen day;
  arrows, Page Up/Down, Shift+Page, Home/End, Enter choosing and closing; `min` / `max` disabling days, months and
  clamping keys; today's mark; the time field (keeps the time on a new day, step, disabled options, clamping to `min`,
  Done); controlled value; invalid value.
- Code, export, messages, messages test entries, gallery case, fixture, README, CHANGELOG `## Unreleased`, visual
  baselines.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck, lint and build pass; visual baselines updated.

### Phase 2: Design System artifact
- Add `DatePicker` / `DateTimePicker` to the bundled artifact and publish.

## Decisions (auto)
- No dependency on `@softure-ai/core`: plain strings in the `LocalDateTime` format; the README shows
  `isLocalDateTime` / `getLocalDateTimeInstant` on the app's side.
- The hours and minutes are native `<select>`s with the field look: a phone opens its own wheel, the keyboard and a
  screen reader get a known control, and nothing else needs a portal inside the popover.
- The time field is disabled until a day is chosen; a new day keeps the chosen time, else `defaultTime` (default
  `09:00`), rounded to the step and clamped into `min` / `max`.
- Default locale `en-US` (deterministic on server and client); the app passes its own.
- A day choice closes `DatePicker`; `DateTimePicker` stays open for the time and closes on Done, Escape or outside.
- Released as a minor: new exports, no change to existing ones.

## Progress
- [ ] Phase 1: DatePicker and DateTimePicker (TDD)
- [ ] Phase 2: Design System artifact
