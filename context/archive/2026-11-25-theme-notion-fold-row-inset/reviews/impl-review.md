# Implementation review: theme-notion-fold-row-inset

Verdict: approve. Matches the plan: the summary is padded `px-2`, the default content `px-2 py-3`, the inset content
`py-2 pr-2 pl-8`, the actions `pr-2`; measured opened rows put the details table under the chevron and the inset
content under the title. The parity fixture changed only in the FoldRow slots, the gallery baselines only in the
FoldRow band. README and CHANGELOG (`Unreleased`, with the override an app drops) say the same; no version bump.
