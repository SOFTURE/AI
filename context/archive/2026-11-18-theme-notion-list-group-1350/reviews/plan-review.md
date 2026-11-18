# Plan review: a sticky group heading for List (#1350)

Verdict: approve.

- Covers every gate a new composition needs (gallery case, parity fixture, inventory, README list, baselines). No copy,
  so the message layer is untouched.
- Sticky positioning cannot be checked in jsdom; the plan measures it in a real browser (Phase 2), which settles the
  issue's three failures (strip above, narrow heading, row hidden under the heading).
- Risk: `**:data-[slot=list-item]:scroll-mt-10` must compile in Tailwind v4; the theme's class test and the gallery
  render will show it.
