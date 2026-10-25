---
change_id: theme-notion-stats-722
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `themes/theme-notion` on master f3c5ba2.

- Scope: the three exports and attributes the acceptance names; nothing domain-specific enters the package.
- Dependency: implementation waits for #720 on master instead of copying its tone maps, so no duplicate definitions
  and no merge conflict in `index.ts` beyond adjacent export lines.
- Tailwind: the new file sits under `src/notion/`, already a theme source, so the literal classes are generated.
- Tests cover every acceptance point: closed fold, three layouts, optional hint and aside, pill order.

Verdict: approved, no changes.
