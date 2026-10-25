# Research: MarkPopover in theme-notion (issue #725)

## Current state (master f3c5ba2)

- `themes/theme-notion/src/notion/` holds the compositions (`Status`, `PageHeader`, `PropertyList`, `PageFrame`),
  exported by name from `src/index.ts`. `softureTheme.sources` in `package.json` lists `./ui` and `./notion`, so
  the kit's `softure-theme-css` names both folders as Tailwind sources: a new file in `notion/` gets its classes
  generated with no kit change.
- `badgeVariants` (`src/ui/badge.tsx`) has the `tag` variant and the nine palette colours plus `none`/`default`;
  `PaletteColor` (`src/notion/palette.ts`) is the nine. `buttonVariants` has `ghost` and `xs`.
- Tokens used by the reference exist: `text-ui`, `text-ui-medium` (`tokens.ts`), `shadow-menu`, `bg-popover`,
  `text-popover-foreground`, `ring`.
- `@types/react` 19 types `popover`, `popoverTarget` and `popoverTargetAction` on DOM elements, so the reference
  type-checks without casts. React 19 renders them as `popover`, `popovertarget`, `popovertargetaction`.
- `"use client"` is the first line of every interactive `ui/` file; `MarkPopover` has an `onClick`, so it is a
  client component too.
- Tests: `renderToStaticMarkup` for markup (node environment, `tests/notion/*.test.tsx`); for events the repo uses
  `// @vitest-environment happy-dom` with `@testing-library/react` (root devDependencies, e.g.
  `foundation/ui/tests/switch.test.tsx`). `fireEvent.click` returns `false` when the default was prevented.
- `tests/index.test.ts` checks the `ui/` files only; compositions are exported explicitly.

## Findings

- The reference drops in as-is: one file `src/notion/MarkPopover.tsx`, one export line, a test file, README and
  CHANGELOG lines.
