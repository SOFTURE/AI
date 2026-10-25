# Research: theme-notion RadioGroup (issue #736)

## Current state (master e6d049c)

- `themes/theme-notion/src/ui/` holds the 36 shadcn new-york v4 files; `tests/index.test.ts` asserts that count and
  that every export of every `ui/` file is in the root barrel. `src/index.ts` re-exports each file with `export *`.
- `checkbox.tsx` carries the deltas the issue asks to mirror: `size-4`, `border-[1.5px] border-muted-foreground`,
  `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring`, `aria-invalid:border-destructive
  aria-invalid:ring-destructive/20`, `data-[state=checked]:border-primary`; shadcn's `shadow-xs` and
  `dark:bg-input/30` are dropped (the design system has no shadows on controls).
- `radix-ui` (already a dependency) exports `RadioGroup` (`Root`, `Item`, `Indicator`); `lucide-react` has
  `CircleIcon`, which shadcn uses for the dot.
- shadcn's item: `border-input text-primary ... aspect-square size-4 shrink-0 rounded-full border shadow-xs
  focus-visible:ring-[3px]`; indicator `relative flex items-center justify-center` with a `CircleIcon`
  `fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2`; root `grid gap-3`.
- DOM tests in the package use `// @vitest-environment happy-dom` with `@testing-library/react` (root devDependencies).
- `./ui` is already a Tailwind source of `theme.css`, so the new file's classes are generated with no build change.

## Findings

- A new `src/ui/radio-group.tsx` (shadcn file name) exported via `export *`; the count test moves to 37, the README
  list and count follow.
