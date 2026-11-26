# Implementation review: theme-notion-dialog-form-size

Verdict: approve. The diff matches the plan: `DialogContent size="form"` adds
`max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-w-2xl` on top of the base `grid`, the phone gutter and
`sm:max-w-lg`; `DialogFooter sticky` adds `sticky -bottom-6 -mx-6 -mb-6 border-t border-border bg-popover px-6 py-4`
and `data-sticky="true"`, before the app's `className`, so the app can still override either. Checked cases: every
existing size renders the same classes (the old size tests pass unchanged and the parity fixture only gained the new
case); the form dialog is 672 px from `md` and inside the 1 rem gutter on a phone, its height capped at the viewport
minus 32 px with the fields scrolling, and the footer's bottom equals the dialog's at scroll top and end (Chromium,
desktop and phone); on a phone the buttons are full width with the primary on top, from `sm` in a row with Cancel on
the left; without `sticky` the footer flows as before (unit test). The upstream guard lists the five new lines as
deltas with one reason; axe is clean on the new gallery case and only its four baselines were added. README,
CHANGELOG `Unreleased` (with the migration from the app's workaround) and the Design System artifact (v107-108)
follow.
