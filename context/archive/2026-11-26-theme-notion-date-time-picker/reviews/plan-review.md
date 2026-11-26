# Plan review: theme-notion-date-time-picker

Verdict: approve. Composing `Popover` and the `Input` look keeps the ui wrappers in shadcn parity. Formatting through
`Date.UTC` with `timeZone: "UTC"` and a fixed default locale keeps the server and client text equal, and plain strings
in the `LocalDateTime` format avoid a new dependency while staying assignable from core's branded type. Native selects
for the time are the simplest accessible control on a phone. The keyboard contract follows the APG pattern and is
testable in happy-dom through key events and focus. Clamping keyboard moves into `min` / `max` (instead of focusing
disabled days) is a deliberate simplification worth a README line. A minor release fits new exports.
