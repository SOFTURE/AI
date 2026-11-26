# Implementation review: theme-notion-row-actions-async

Verdict: approve. The diff matches the plan: one component file, its tests, README and CHANGELOG. A synchronous
`onSelect` keeps the 0.35.0 behaviour (the existing "runs it only on confirm" test still passes), so the change is
additive. The pending state blocks every close path: the buttons are disabled and `onOpenChange` ignores Escape and
outside clicks, covered by the Escape assertion. A rejection is handled (no unhandled rejection inside the theme) and
leaves the dialog open and enabled, as the JSDoc and README tell the app to report its own error. `opensDialog` resets
its flag on every selection, so a later plain item still returns focus to the button (tested). `triggerRef` accepts a
callback or an object ref. The touch class does not fight `min-h-7` in tailwind-merge (both stay; the media query wins
below `md`), confirmed by the computed `min-height: 44px` in Chromium. No Polish outside dictionaries; no new
dependency.
