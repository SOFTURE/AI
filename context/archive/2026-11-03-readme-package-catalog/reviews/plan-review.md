---
change_id: readme-package-catalog
verdict: approved
---

# Plan review: readme-package-catalog

- Covers the reported gap, its siblings in the same block, and a guard so the next package cannot repeat it.
- The test reads the README's own structure (group headers at column 0, two-space children), which every current
  line follows; the `theme-<name>/` placeholder is skipped explicitly rather than by a pattern that could hide typos.
- CHANGELOG lines for README-only edits follow docs/02 §12 (the README ships in the tarball); they ride the next
  release, no bump here. The packages being published for the first time are only touched in docs on master, which
  does not affect their tags. Approved.
