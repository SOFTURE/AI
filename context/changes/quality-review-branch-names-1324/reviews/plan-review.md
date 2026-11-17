# Plan review: quality-review-branch-names-1324

Verdict: approved, no blocking findings.

- Checked: git refuses only a ref that is a `/`-prefix of another; the new names hold no `/`, none equals
  `quality-review` and none starts with `quality-review/`, so they also coexist with branches 0.2.0 already pushed.
- Checked: `getScopeSlug` maps every run of non-alphanumerics to one dash and trims the ends, so a slug never holds
  `--` and `quality-review--<slug>` cannot be confused with a focus name.
- Checked: the whole `resolve` output is appended to `GITHUB_OUTPUT`; a new `report-branch=` key adds a step output
  and does not clash with `branch=`, which the step writes after it.
- Suggestion (accepted): run the edited resolve step in bash against the built CLI, since the YAML test only checks
  strings.
- Coordination: #1325 changes `src/review.ts`, `src/report.ts`, `src/findings.ts`, the security prompt and its
  README section; only CHANGELOG `## Unreleased` can conflict, resolved by whoever merges second.
