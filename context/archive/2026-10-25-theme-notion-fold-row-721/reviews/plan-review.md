---
change_id: theme-notion-fold-row-721
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the issue's API and reference implementation, and #720's proposal.

- Scope: two new files in `src/notion/`, exports, tests, docs; no existing component changes.
- Reuse: `Badge` `tag` and `ICON_STROKE_WIDTH` reused; tones come from #720, not duplicated.
- Risks: Tailwind must see the classes; `./notion` is already a theme source. The barrel test asserts no undefined
  export. Phase 2 cannot typecheck before #720 lands; the phase order keeps Phase 1 independent.
- Tests cover every acceptance point (values left out, empty, order and `data-tone`, closed by default).

Verdict: approved, no changes.
