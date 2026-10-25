---
change_id: theme-notion-a11y-747
verdict: approved
---

# Implementation review

Reviewed d22c0d4 against plan.md and issue #747.

- `Item` renders `role="listitem"` only inside an `ItemGroup` and not with `asChild`; the caller's `role` spreads
  after it and wins. A lone `Item` renders exactly as before.
- `ScrollArea`'s viewport renders `tabIndex={0}` before `viewportProps`, so `tabIndex: -1` overrides it; the
  viewport's classes merge with `viewportProps.className` instead of being replaced. `data-slot` stays overridable
  as in the other parts.
- Tests (6 new) cover listitem in a group, none outside, `asChild`, caller role, default and overridden tab stop.
- README deltas and CHANGELOG (Unreleased) updated; no version bump. Gates: typecheck, lint, theme-notion tests green.
- Follow-up outside this change: #741 lists both deltas in `tests/upstream/deltas.ts` and removes the gallery's
  known-violation entries.

Verdict: approved.
