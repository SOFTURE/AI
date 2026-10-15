---
change_id: config-language-quote-marker-517
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: config-language-quote-marker-517

Reviewed: the branch diff against plan.md, change.md and issue #517.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Without markers the result is as before: every existing language test passes unchanged, and diacritics in code spans are still hits (new test). | No change. |
| 2 | Check | A marked quote is skipped on one line and across lines; text after the closing marker and the next line are checked (tests). | No change. |
| 3 | Check | An unclosed marker is a hit on the line that opened the last region, so it cannot exempt the rest of a file. | No change. |
| 4 | Check | Markers inside code spans and in non-Markdown files are text, so the README and code comments cannot open a region. | No change. |
| 5 | Check | Every CLI mode and this repository's own gate go through `findPolishText`; no CLI change was needed. | No change. |
| 6 | Check | Docs: README paragraph and example, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
