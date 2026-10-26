---
change_id: blog-aside-word-length-700
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (13e34df).

- Scope covers the issue: formula variables and one-letter words no longer make an aside worded, in both the article
  gate and the copy check (one shared counter).
- Regression guard: the existing tests with real worded asides stay; the plan adds a two-real-asides case next to the
  formula case.
- Risk: an aside of one long word and one-letter words (`(w Polsce)`) now counts one word, so it is not worded. That
  matches the rule's intent ("two words or more").
- Compatibility: fewer findings only; no API change.

Verdict: approved, no changes.
