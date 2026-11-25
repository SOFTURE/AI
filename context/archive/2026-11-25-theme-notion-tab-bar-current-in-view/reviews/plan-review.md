# Plan review: theme-notion-tab-bar-current-in-view

Verdict: approve. One component, test first, with the layout stubbed the way `tabs-scrollable.test.tsx` already does.
Scrolling through the nav's own `scrollLeft` meets "without moving the page" by construction, and the test asserts
the page APIs stay untouched. The mask needs no colour token and is static, so reduced motion is honoured. Adding
`"use client"` keeps the props serialisable (strings, numbers, an icon element), so server pages keep rendering it.
The parity fixture and the class-coverage test catch the new classes.
