# Implementation review: theme-notion-dialog-first-field

Verdict: approve. Matches the plan: one helper, wired into `DialogContent` and `SheetContent` after the app's own
`onOpenAutoFocus`, focusing the first enabled field as Radix focuses (no scroll, text selected). The tests cover the
issue's acceptance (field focused, no tooltip; keyboard focus on the trigger still opens it), disabled, hidden and
combobox fields, the no-field default and the app's override, on both components. The upstream deltas list the three
edits per file with the issue as reason. `AlertDialog` is untouched, as decided. README and CHANGELOG (`Unreleased`,
with the workaround an app drops) say the same; no version bump.
