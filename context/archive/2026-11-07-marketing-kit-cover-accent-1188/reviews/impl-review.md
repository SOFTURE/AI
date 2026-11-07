---
change_id: marketing-kit-cover-accent-1188
verdict: approved
---

# Implementation review (auto)

- #1188: `accent: true` sets the `kicker-title` kicker in `colors.accent` (checked against the scrim colour) and the
  `pill` box in the opaque accent with the better-reading label colour; another layout and an accent under 3:1 are
  errors naming both colours and the ratio. `MIN_COVER_ACCENT_CONTRAST` exported from `/og`.
- Tests written first (5 failed without the change): kicker lime above a light title, no lime without the accent;
  lime pill with a dark label; `accent: false` byte-for-byte equal to no accent; the three refusals. A teal-accent
  sample of both layouts was rendered and looked at.
- Evidence: `npx vitest run tools/marketing-kit/tests/og tests/repo` (all passed), `npm run typecheck`, ESLint on
  the changed files.
- Approved.
