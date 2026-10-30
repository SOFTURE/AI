---
change_id: theme-notion-dialog-wide-902
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (95c963c).

- Acceptance of #902: `size="wide"` gives `sm:max-w-lg lg:max-w-1/2`, half the viewport from `lg`, `max-w-lg`
  between `sm` and `lg`, `max-w-[calc(100%-2rem)]` on phones; documented in the README and the parity fixture
  (the design-system snapshot of component classes). Phase 1 and 2.
- Acceptance of #903: `closeLabel="Anuluj"` names the button, the default is the message. Phase 1.
- Compatibility: both props optional; the default class list is unchanged, so existing fixture entries and
  baselines stay except the gallery page that gains a case.
- The scrolling body slot is optional in #902 and deliberately left out; noted in the decisions.

Verdict: approved, no changes.
