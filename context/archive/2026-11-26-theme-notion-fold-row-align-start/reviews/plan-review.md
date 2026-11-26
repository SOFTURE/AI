# Plan review: theme-notion-fold-row-align-start

Verdict: approve. The prop is additive and the default keeps every class of 0.36.0, which the existing exact-class
tests guard. `md:justify-start` lines the status up with the summary's first line because the column and the summary
share the same 4 px top padding, so no magic offset is needed. The chevron box sized by `1lh` of the `ui` style
follows the type token instead of a hard-coded margin. Both summary shapes are covered, and the issue's repro is
checked in a real browser, since class assertions alone cannot prove the alignment.
