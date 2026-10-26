---
change_id: theme-notion-class-parity-735
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #735.

- Sidebar: the `none` root, the phone `SheetContent` and `sidebar-gap` carry the issue's expected strings; the gap's
  `group-data-*` lines are unchanged. `tests/ui/sidebar.test.tsx` covers all three (the phone sheet under happy-dom
  with a phone-width `matchMedia`, opened through `SidebarTrigger`).
- Checkbox `CheckIcon` `size-3.5`; Select `ChevronUpIcon` `size-4` and `SelectItem` muted icons; `FieldTitle` the
  design system's string. One test each; the scroll-up test scrolls the list so Radix mounts the button.
- The seven new tests fail on the 0.2.0 sources (checked by stashing the source changes) and pass with the fix.
- `page.css`: `@layer base`, `html` smoothing, `body` `text-sm` through `--theme()`, `::selection` on `--blue-tag`.
  Declared in `softureTheme.stylesheets`, exported, built to `dist/` (`npm run build -w @softure-ai/theme-notion`),
  compiled by the real Tailwind CLI in `tests/theme-css.test.ts`.
- Docs: both README wirings import `page.css`; CHANGELOG under `Unreleased` with the migration line.
- Release note for the coordinator: theme-notion only, a patch is enough (fixes plus a new opt-in export); no
  package depends on theme-notion.

Verdict: approved.
