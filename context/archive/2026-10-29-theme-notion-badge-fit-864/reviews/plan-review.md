---
change_id: theme-notion-badge-fit-864
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (e96ac81).

- Scope covers the acceptance: a badge never leaves its container (`max-w-full`), a `Status` word ends in an ellipsis
  while the icon stays (`min-w-0 truncate` span, `shrink-0` icon), and a browser test measures it in a 120 px parent.
- Compatibility: a badge that fits renders identically; the extra span in `Status` is inline content with the same
  gap, so no baseline moves. An app selector that read `Status`'s text node directly still finds the text.
- Upstream parity: the change rides the existing base-string delta with its reason, so the guard stays exact.
- Design system: phase 4 keeps the artifact in step.

Verdict: approved, no changes.
