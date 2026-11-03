# Research: theme-notion formatFileSize on the server (issue #1005)

## Findings

- `themes/theme-notion/src/notion/Upload.tsx` starts with `"use client"` and defines `SIZE_UNITS` and
  `formatFileSize` (pure `Intl.NumberFormat`, no React). `src/index.ts` re-exports `formatFileSize` from it. Under the
  App Router, a server module's import of a client module's export resolves to a client reference, so calling it throws
  ("Attempted to call formatFileSize() from the server").
- Scan of every `"use client"` module under `themes/*/src` for exports that are neither components (PascalCase) nor
  hooks (`use[A-Z]…`):
  - `theme-notion/src/notion/Upload.tsx`: `formatFileSize` (the bug).
  - `theme-notion/src/ui/tabs.tsx`: `tabsListVariants`, a `cva` class builder. Same class of bug, but the file is the
    pinned shadcn new-york v4 upstream (`tests/upstream/tabs.tsx.txt` exports it from the same client module), and
    every `src/ui/*.tsx` must have a pinned upstream file, so moving it means a new delta and a new file shape in `ui/`.
- theme-flat-paint has no such export.
- The #770 guard in `tests/repo/themes.test.ts` already reads every theme's source files and detects the directive
  (comments allowed before it); a second case can reuse `listSourceFiles` and `hasClientDirective`.

## Conclusion

Move `SIZE_UNITS` and `formatFileSize` to `src/notion/format-file-size.ts` (no directive); `Upload.tsx` imports it;
the root re-exports it from there. Add a contract case: a client module exports only components and hooks. Exempt
`ui/tabs.tsx` `tabsListVariants` by name, with its reason, and file a follow-up issue for it.
