# Implementation review: theme-notion-badge-data-color

Verdict: approve. Matches the plan: `Badge` sets `data-color` from its `color` (nothing for `none`, `null` or no
colour) before the props spread, so `Status` keeps exactly one `data-color`, its own, and a caller's value wins. The
upstream delta records the line; the parity fixture is unchanged; the only other tests touched are the two `Stats`
aside assertions, which now see the attribute their tag badge carries. README and CHANGELOG (`Unreleased`, with the
override an app drops) say the same; no version bump.
