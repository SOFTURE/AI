# Plan: theme-notion tabsListVariants on the server (issue #1008)

## Phase 1: the plain module

Files: `themes/theme-notion/src/ui/tabs-variants.ts` (new), `themes/theme-notion/src/ui/tabs.tsx`,
`themes/theme-notion/src/index.ts`, `themes/theme-notion/tests/upstream/deltas.ts`, `tests/repo/themes.test.ts`,
`themes/theme-notion/README.md` (if it lists server-safe helpers), `themes/theme-notion/CHANGELOG.md`.

1. Test first: drop the exemption from `CLIENT_VALUE_EXPORTS_ALLOWED`; the guard fails with
   `themes/theme-notion/ui/tabs.tsx: tabsListVariants`.
2. Move the `cva` block to `src/ui/tabs-variants.ts` (no directive), exported as `tabsListVariants`; `tabs.tsx`
   imports it and the `VariantProps` type, and exports only the four components; `index.ts` adds
   `export * from "./ui/tabs-variants.js"`.
3. Append three deltas to the `tabs` list in `deltas.ts` (imports, the removed block, the export list), reason
   "the class builder in the plain module `tabs-variants.ts` so a Server Component can call it (#1008)".
4. A test that the root's `tabsListVariants` still returns the line classes by default.
5. CHANGELOG `## Unreleased`: the fix; README note next to the formatFileSize one if there is one.

## Decisions (auto)

- Keep the empty `CLIENT_VALUE_EXPORTS_ALLOWED` set with its comment, so a later exemption has a place.
- Deltas appended, not rewritten: the earlier deltas keep their reasons and order.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: the plain module
