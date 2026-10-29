---
change_id: theme-kit-cn-spacing-860
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a5301e4).

- Acceptance of #860: `cn("size-7", "size-touch-target")` gives `"size-touch-target"`, with the issue's other pairs.
  Covered by phase 1 tests through `createThemeCn`.
- Generic: the names come from `ThemeDefinition.sizes`, no theme names in the kit.
- Compatibility: optional input key, no signature break; themes get the fix by the patch release alone.
- Scope: text styles and shadows untouched; a size name next to a text style keeps both (tested).

Verdict: approved, no changes.
