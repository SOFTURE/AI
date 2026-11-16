---
change_id: mcp-access-mcp-apps
verdict: approved
---

# Plan review

- Every scope line has a test written first; the bridge test runs the real script string, not a copy.
- Risk: hosts read `_meta.ui.resourceUri` or the legacy key; both are set.
- Risk: a page script containing `</script>` would end the element early; covered by the escape test.

Verdict: approved, no changes.
