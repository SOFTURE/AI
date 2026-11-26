# Implementation review: theme-notion-fold-row-align-start

Verdict: approve. The diff matches the plan: one optional prop, `ITEMS_CLASS` maps it to `items-center` or
`items-start` on the summary, the slot and the fixed heading, and the right column swaps `md:justify-center` for
`md:justify-start`. The default renders the same markup and class order as 0.36.0 (the existing exact-class tests
pass unchanged), and the chevron box exists only with `start`. The new tests failed before the code and cover both
summary shapes and the default. The browser check shows the chevron and the title on one line and the status 3 px
lower (a status pill is taller than a text line), which the issue's expectation ("status on line 1") meets.
`FoldRowAlign` is exported from the package index. README and CHANGELOG `Unreleased` describe the prop. No
non-English text outside the exempt places.

## Findings
- None blocking.
