---
change_id: theme-notion-touch-sizes-880
---

# Research: touch sizes for menus, tabs, accordion and dialog close (issue #880)

## What exists

- #859 (archived `2026-10-29-theme-notion-touch-sizes-859`) set the pattern: `SelectContent size` reaches the items
  through a React context (the items render in a portal), `SelectItem size` wins over it, and the touch height is a
  plain class (`min-h-touch-target`) chosen instead of `min-h-7`, so a caller's `md:min-h-7` brings the pointer size
  back on a desktop.
- `src/ui/dropdown-menu.tsx`: `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem` and
  `DropdownMenuSubTrigger` all carry `min-h-7` in their static class string. `DropdownMenuContent` wraps a portal;
  `DropdownMenuSubContent` renders inside the content's tree, so a context from the content reaches sub-menu items.
- `src/ui/tabs.tsx`: `TabsList` (cva `tabsListVariants`, exported) is `h-9` in a horizontal `Tabs`, and
  `TabsTrigger` is `h-[calc(100%-1px)]`, so the list's fixed height caps its triggers. A touch list must drop the
  fixed height (`h-auto`; `tailwind-merge` resolves it against `h-9` under the same group variant) and let the
  triggers set it. An icon-only trigger can be narrower than 44 px, hence `min-w-touch-target` too.
- `src/ui/accordion.tsx`: `AccordionTrigger` is `py-4` with `text-sm` (52 px) by default, but apps tighten the
  padding for lists; `min-h-touch-target` keeps 44 px whatever the padding.
- `src/ui/dialog.tsx`: the close button is a bare 16 px icon at `top-4 right-4`. A 44 × 44 box centred on the same
  icon sits at `top-0.5 right-0.5` (16 + 8 − 22 = 2 px).
- `createThemeCn` merges the theme's spacing names since #860, but the published theme still allows
  `@softure-ai/theme-kit ^0.1.4`; choosing one class or the other (as `SelectItem` does) does not depend on it.
- Guards: `tests/upstream.test.ts` with `tests/upstream/deltas.ts`, `tests/parity.test.tsx` with
  `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`), `tests/tailwind-classes.test.ts`.

## Options

1. Per-component `size` props plus list contexts, plain classes (the #859 pattern). Chosen.
2. CSS-only: `group-data-[size=touch]/tabs-list:min-h-touch-target` on the trigger. A trigger's own `size="default"`
   could not win over its list without a second selector. Rejected.
3. Dialog close always 44 px on phones (`max-md:`): changes every app's dialog without opting in, which the issue
   forbids. A `closeButtonSize` prop instead.
