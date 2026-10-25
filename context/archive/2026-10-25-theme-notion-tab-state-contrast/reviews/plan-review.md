---
change_id: theme-notion-tab-state-contrast
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `src/ui/tabs.tsx` and `tests/contrast.test.ts` on the base branch.

- Scope: one class string of `TabsTrigger`; no token or export change. The line variant keeps its underline.
- Look: the pill keeps its fill and shadow and gains a field-weight hairline; before/after screenshots of both schemes
  go to the coordinator.
- Risks: `bg-clip-padding` shrinks the fill by the 1 px border on every trigger; unselected triggers have a
  transparent fill, so nothing shows. The line override and the focus border depend on the compiled order of
  Tailwind's variants; step 1 must check the compiled CSS, not only the class string.
- Tests: the contrast test gains the pill pairs measured with the border composited as the browser paints it.

Verdict: approved, no changes.
