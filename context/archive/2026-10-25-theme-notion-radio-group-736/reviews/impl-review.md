---
change_id: theme-notion-radio-group-736
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and issue #736.

- Scope: `src/ui/radio-group.tsx` in theme-notion, its root export, tests, the component count test (37), README and
  CHANGELOG (Unreleased). No other package changes, no version bump.
- Look: shadcn new-york v4 structure and slots kept (`radio-group`, `radio-group-item`, `radio-group-indicator`);
  the item carries the `checkbox` deltas (`size-4`, `border-[1.5px] border-muted-foreground`,
  `data-[state=checked]:border-primary`, `focus-visible:ring-2 focus-visible:ring-ring`, `aria-invalid` classes) and
  drops `shadow-xs` and `dark:bg-input/30` as `checkbox` does; the dot is `fill-primary` on `text-primary`.
- Tests (happy-dom): slots; the checked item has `data-state="checked"`, `aria-checked` and the dot, an unchecked one
  has no indicator; ArrowDown and ArrowUp move the focus and the choice and call `onValueChange`; the delta classes.
- Gates: typecheck, ESLint, the language gate and the theme-notion tests (95) pass; the full suite runs on push.

Verdict: approved.
