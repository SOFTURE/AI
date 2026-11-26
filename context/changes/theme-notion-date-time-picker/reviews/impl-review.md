# Implementation review: theme-notion-date-time-picker

Verdict: approve, no blocking findings. The code follows `plan.md`: one internal picker behind `DatePicker` and
`DateTimePicker`, plain `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings, the APG keyboard contract, `min` / `max` on days,
months, keys and times, a hidden input under `name`, native selects for the time, 44 px targets below `md`. Progress is
honest: the tests were red (missing module) before the code, the gates and the visual baselines with axe ran, and the
artifact was checked in Chromium.

## Findings
- Suggestion (accepted, done): the gallery first named a trigger with `aria-label`; axe reported
  `label-content-name-mismatch`, so the gallery uses `Label` and the README says to.
- Suggestion (kept): a controlled `open` that opens again keeps the "today" computed on the first open; a picker left
  open past midnight marks yesterday until it is reopened from the trigger. Harmless; not worth an interval.
- Suggestion (kept): the hidden input cannot carry `required`; an app validates the value on the server, which it must
  do anyway for a server action.
