# Implementation review: marketing-kit-overlay-polish

- Drift from the plan: the chip's left padding equals its vertical padding (added during the build, so the badge
  sits evenly in the pill and the row needs less room).
- Tests: every changed expectation now states the frame's centre; the burn test checks the covered point is drawn
  fainter, the markup test the tweens; browser tests run with Playwright's Chromium.
- Exports: the new constants and helpers are in `src/index.ts`.
- Verdict: approve.
