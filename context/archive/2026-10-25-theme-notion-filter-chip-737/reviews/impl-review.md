---
change_id: theme-notion-filter-chip-737
verdict: approved
---

# Implementation review

Reviewed commit 8224090 against plan.md and issue #737.

- API: the issue's props, plus `FilterChipAddProps` (`label`, `children`, `className`); both exported from the root.
- Look: `h-6`, `rounded-full`, `text-sm`, `text-muted-foreground`, `hover:bg-accent`; active `bg-blue-tag
  text-blue-tag-foreground`, kept on hover and while open (the plan review's risk note); 14 px chevron through
  `size-3.5`, a caller's icon with its own `size-*` left as it is; content in `DropdownMenuContent` (`rounded-xl`,
  `shadow-menu`), aligned to the start.
- Accessibility: the trigger is a Radix menu button (`aria-haspopup="menu"`, `aria-expanded`), the chevron and plus
  are hidden, the name reads "Status: all". Opening from pointer and Enter is tested.
- Copy: "Add filter" lives in `messages/en.ts` and is replaceable through `label`.
- Build: `dist/notion/FilterChip.js` is under the `./notion` Tailwind source, so the classes reach an app's CSS.
- Gates: typecheck, ESLint, language gate green; theme-notion tests 100/100.

Verdict: approved, no changes.
