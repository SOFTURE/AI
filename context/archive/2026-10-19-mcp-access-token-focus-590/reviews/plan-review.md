---
change_id: mcp-access-token-focus-590
reviewed: 2026-10-19
verdict: approved
---

# Plan review: mcp-access-token-focus-590

Checked plan.md against change.md, research.md, issue #590 and `token-manager.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Focusing on every render would steal focus while the owner copies a snippet. | The effect depends on `issued.id` only, so it runs once per issued token; covered by the second-token test. |
| 2 | Minor | The rAF callback may run after the component unmounted (the owner left the page). | Read the form through the ref at call time and skip when it is gone or the field is not an input. |
| 3 | Check | `tabIndex={-1}` keeps the heading out of the tab order and only makes it programmatically focusable. | No change. |
| 4 | Check | Parallel #589 edits the same file (props, headings); conflicts are resolved by merging master before the merge. | No change. |

No Critical findings.
