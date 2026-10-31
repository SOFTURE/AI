---
change_id: theme-notion-dialog-sizes
status: done
---

# Research

- `themes/theme-notion/src/ui/dialog.tsx`: `DialogContent` is `fixed top-[50%] left-[50%] grid w-full
  max-w-[calc(100%-2rem)] … p-6 sm:max-w-lg`; `size="wide"` adds `lg:max-w-1/2` (#902). Height follows the content,
  with no cap: a long form overflows the viewport unless the app adds `max-h-*` and `overflow-y-auto`.
- An adopting app draws its edit dialogs full screen (`top-0 left-0 h-dvh w-screen max-w-none translate-*-0
  rounded-none p-0`) with a fixed header, a scrolling body and a fixed footer; its feedback form uses `wide`; two
  settings dialogs set `sm:max-w-lg`/`sm:max-w-xl` and `max-h-[85dvh] overflow-y-auto` themselves.
- `cn` is `tailwind-merge`: a size's classes placed after the base override `grid`, `sm:max-w-lg` and so on, so a
  size needs no change to the base string.
- The upstream guard (`tests/upstream.test.ts`) compares `src/ui/*.tsx` with the shadcn sources plus
  `tests/upstream/deltas.ts`; the `wide` entries are the ones to extend.
- `tests/ui/dialog.test.tsx` asserts the classes per size; the README's `dialog` note documents `wide`.
