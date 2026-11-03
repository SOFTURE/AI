---
change_id: theme-notion-tabs-variants-server-1008
verdict: approved
---

# Implementation review

Reviewed commit f4e4269 against plan.md and issue #1008.

- Fix: `tabsListVariants` lives in `themes/theme-notion/src/ui/tabs-variants.ts`, which has no directive; `tabs.tsx`
  imports it and exports only the four components; the root exports it from the plain module. The built
  `dist/ui/tabs.js` ends `export { Tabs, TabsList, TabsTrigger, TabsContent }` and `dist/index.js` re-exports the
  builder from `./ui/tabs-variants.js` (checked).
- Upstream pin: three deltas appended to the `tabs` list with one reason (imports, the removed block, the export
  list); the 18 earlier deltas are unchanged; `tests/upstream.test.ts` green.
- Guard: the exemption is gone (`CLIENT_VALUE_EXPORTS_ALLOWED` is empty); the case failed with exactly
  `themes/theme-notion/ui/tabs.tsx: tabsListVariants` before the move (checked) and passes after.
- Inventory: the cva axes reader now covers `ui/*.ts`, so the gallery check still sees the builder (it failed without).
- Test: the root's builder is the plain module's, and it gives the line classes by default and `bg-muted` for default.
- Docs: README tabs entry and CHANGELOG `Unreleased`. No visual change, so the NOTION · Design System artifact needs no
  sync (its bundle re-exports the root, which keeps the name).
- Gates: typecheck, ESLint, language gate (pre-commit); theme-notion and `tests/repo/themes.test.ts` 1103/1103.

Verdict: approved, no changes.
