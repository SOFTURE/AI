# Research: theme-notion "use client" in item.tsx (issue #770)

## Findings

- `themes/theme-notion/src/ui/item.tsx` declares `const ItemGroupContext = React.createContext(false)` at module level
  and calls `React.useContext` in `Item`. It has no `"use client"`. `src/index.ts` re-exports it, so any server import
  of the package root evaluates it under the `react-server` condition, where `createContext` is undefined.
- Scan over `themes/*/src` (files that call `createContext` or a `use*(` hook, without `"use client"` on line 1):
  - `theme-notion/src/ui/item.tsx`: the bug.
  - `theme-kit/src/react/use-is-mobile.ts`: a hook module. It only defines `useIsMobile`; nothing runs at import, and
    its sole consumer (`sidebar.tsx`) is a client module. Safe in a server graph, so not a violation.
- 27 other files already start with `"use client"` (sidebar, Sortable, dialogs, menus).
- A runtime smoke test (import the built root under `--conditions=react-server`) is not workable without a bundler:
  plain Node evaluates `"use client"` modules too, so Radix's own module-level contexts would fail the import even
  when the theme is correct. Next's bundler stops at the directive; Node does not.

## Conclusion

Add the directive to `item.tsx`. Guard statically in `tests/repo/themes.test.ts`: in every theme package, a `.tsx`
file under `src/` that calls `createContext` or a React hook, and any source file that calls `createContext`, starts
with `"use client"`. Plain `.ts` hook modules stay allowed (they run nothing at import).
