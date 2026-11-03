# Research: theme-notion tabsListVariants on the server (issue #1008)

- `themes/theme-notion/src/ui/tabs.tsx` starts with `"use client"` (it creates a context and calls hooks) and defines
  `tabsListVariants = cva(...)`; its last line exports it with the components. The root `src/index.ts` re-exports the
  module with `export * from "./ui/tabs.js"`.
- In a Server Component, every export of a client module is a client reference, re-exports included, so the builder
  must neither be defined nor re-exported in `tabs.tsx`; the root must export it from a plain module.
- `tests/upstream.test.ts` pins every `src/ui/*.tsx` file to its shadcn new-york v4 copy plus the listed deltas in
  `tests/upstream/deltas.ts`, applied in order as unique string replacements. Only `.tsx` files are pinned, so a new
  `src/ui/tabs-variants.ts` is outside the guard. Appending deltas to the end of the `tabs` list (matched against the
  text after the earlier deltas) leaves the 18 existing ones untouched.
- `tests/repo/themes.test.ts` (from PR #1010) exempts `themes/theme-notion/ui/tabs.tsx: tabsListVariants` by name.
- Other users: `tests/gallery/cases.tsx` names `tabsListVariants` only as a gallery key (no import). The NOTION ·
  Design System artifact bundles the root exports, which keep the builder; no visual change, so no sync.
