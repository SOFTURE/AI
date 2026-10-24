---
change_id: themes-notion-708
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md, issue #708 and the reference app's implementation.

- Scope: two new packages under the new `themes/*` workspace group, the Vitest include, the root README; no existing
  package changes. Nothing app-specific moved: the reference app's meaning tables, screens and copy stay there.
- Kit: `buildThemeCss` writes the dark variant, the light block on `:root` / `.light` / `[data-theme=light]`, the
  system dark block guarded by `:not(.light, [data-theme=light])`, the explicit dark block after the light one, and
  `@theme inline`; it refuses unsafe values, non-kebab names and dangling aliases (tested). `createThemeCn` keeps
  named text styles beside text colours (tested against tailwind-merge's default, which drops them).
- Theme: `NOTION_THEME` equals the snapshot in colours (order, values, aliases), shadows, fonts, text styles, radii
  and sizes; it defines every shadcn colour role. The 36 components compile under NodeNext with relative `.js`
  imports; `"use client"` stays at the top of the built files. A test compiles `theme.css` with the real Tailwind CLI
  over the component sources: the theme utilities, tw-animate-css's classes and the theme's `dark:` rule are
  generated, Tailwind's palette is not. The built `dist/theme.css` was also compiled from a scratch app folder.
- Deviations from the reference: `input-group` used `calc(var(--radius)-5px)`, but the theme defines no `--radius`;
  it takes `rounded-xs` / `rounded-sm`. `sonner` takes `theme` as a prop instead of `next-themes`. The built-in
  English texts come from `messages/en.ts` with props to replace them.
- Gates: typecheck, ESLint, the language gate, `npm run build` and the full test suite pass.

Verdict: approved.
